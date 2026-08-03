// Server-side car identification via the Claude vision API.
//
// Accuracy comes from four things, in order of impact:
//   1. A big enough image that badges and light signatures survive (the client
//      sends ~2576px — the model's high-resolution limit).
//   2. Zooming in. A badge occupying 2% of a wide shot gets almost none of the
//      vision encoder's attention; the same badge cropped and blown back up to
//      full frame gets all of it. Each pass marks the detail it would zoom into
//      to confirm its answer, and whenever the looks aren't already unanimous
//      and certain we crop to that detail and read it properly. This buys more
//      than thinking harder about the wide shot does.
//   3. Forcing the model to write down what it can SEE before it commits to a
//      name, so the answer is grounded in the photo instead of a vibe.
//   4. A genuine second opinion: an independent pass identifies the car from
//      scratch, and only an agreement between two separate looks is trusted.
//      The two passes run concurrently, so the check costs no extra wall-clock
//      unless they actually disagree.

import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";

export type CarReport = {
  isCar: boolean;
  make: string;
  model: string;
  yearRange: string;
  generation: string;
  trimGuess: string;
  bodyStyle: string;
  color: string;
  countryOfOrigin: string;
  engine: string;
  drivetrain: string;
  horsepower: string;
  zeroToSixty: string;
  topSpeed: string;
  priceRangeUsed: string;
  funFacts: string[];
  confidence: "high" | "medium" | "low";
  notes: string;
  // Added info
  parentCompany: string;
  rarityScore: number; // 0-100
  rarityReason: string;
  valueTimeline: { year: string; usd: number }[];
  goodDealUsd: number;
  // Max-tier
  valuation: string;
  reliability: string;
  collectibility: string;
  // Grounding + cross-check
  visualEvidence: string[];
  alsoConsidered: string;
  crossChecked: boolean;
  crossCheckNote: string;
};

const DEFAULT_MODEL = "claude-opus-5";

// This pipeline depends on structured outputs, so an override naming a model
// without them would 400 on every scan. Honour the env var only when it names a
// model that can actually run this, and otherwise fall back rather than break
// spotting for a value nobody remembers setting.
const STRUCTURED_OUTPUT_CAPABLE =
  /^claude-(opus-(5|4-8)|sonnet-5|haiku-4-5|fable-5|mythos-5)$/;

function pickModel(): string {
  const override = process.env.CAR_SPOTTER_MODEL?.trim();
  if (!override) return DEFAULT_MODEL;
  if (STRUCTURED_OUTPUT_CAPABLE.test(override)) return override;
  console.warn(
    `CAR_SPOTTER_MODEL="${override}" can't run the identification pipeline (needs structured outputs) — using ${DEFAULT_MODEL}.`,
  );
  return DEFAULT_MODEL;
}

const MODEL = pickModel();

// Fast mode runs the same model at up to 2.5x output speed. Only Opus 5 / 4.8
// support it, so a CAR_SPOTTER_MODEL override silently drops back to standard.
const FAST_CAPABLE = /^claude-opus-(5|4-8)$/;
let fastMode = FAST_CAPABLE.test(MODEL) && process.env.CAR_SPOTTER_FAST !== "0";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

// Effort is the main thing standing between a spotter and their answer: it sets
// how long the model deliberates before writing, and on the happy path this one
// call is the whole wait. `medium` is the balance point — the zoom pass now
// backstops the hard cars, so the wide-shot look doesn't have to carry them
// alone. Raise it with CAR_SPOTTER_EFFORT if accuracy ever matters more than
// the wait.
const REPORT_EFFORT = (process.env.CAR_SPOTTER_EFFORT as Effort) || "medium";

// `effort` is rejected outright by Haiku 4.5 and Sonnet 4.5, so a
// CAR_SPOTTER_MODEL override pointing at one of those must not send it.
const EFFORT_CAPABLE = /^claude-(opus-(5|4-8|4-7|4-6|4-5)|sonnet-(5|4-6)|fable-5|mythos-5)$/;
const supportsEffort = EFFORT_CAPABLE.test(MODEL);

export class IdentifyError extends Error {}

// --- Schemas -----------------------------------------------------------------
// Structured outputs require `additionalProperties: false` and every property
// listed in `required` — the model writes "" / 0 for anything it can't judge.

const IDENTITY_PROPS = {
  make: { type: "string" },
  model: { type: "string" },
  yearRange: { type: "string", description: "e.g. '2018-2021' or '2020'" },
  generation: { type: "string", description: "Generation/chassis code if known, else ''" },
  trimGuess: { type: "string", description: "Best-guess trim, or '' if unsure" },
} as const;

const EVIDENCE_PROP = {
  type: "array",
  items: { type: "string" },
  description:
    "3-4 short notes on what is literally visible in THIS photo and led you to the answer: badge text, grille shape, headlight/taillight signature, wheel design, mirror and door-handle style, roofline, exhaust layout. Observations only — no conclusions.",
} as const;

function objSchema(props: Record<string, unknown>) {
  return {
    type: "object",
    properties: props,
    required: Object.keys(props),
    additionalProperties: false,
  };
}

// Fractions of the frame rather than pixels: the model never has to know what
// the image was resized to, and a box can't be out by a scale factor.
const REGION_PROP = {
  ...objSchema({
    x: { type: "number", description: "Left edge, 0-1 across the width." },
    y: { type: "number", description: "Top edge, 0-1 down the height." },
    w: { type: "number", description: "Width as a fraction of the image width." },
    h: { type: "number", description: "Height as a fraction of the image height." },
  }),
  description:
    "A tight box around the ONE detail you would zoom into to confirm this car against the car you nearly said instead — usually a badge, a taillight's internal pattern, a grille, or a wheel centre. Box the detail itself, not the whole car.",
} as const;

// Evidence is listed first so the model records what it sees before naming the car.
const REPORT_SCHEMA = objSchema({
  visualEvidence: EVIDENCE_PROP,
  zoomRegion: REGION_PROP,
  isCar: { type: "boolean", description: "True if a car/vehicle is clearly visible." },
  ...IDENTITY_PROPS,
  alsoConsidered: {
    type: "string",
    description:
      "The most plausible car you rejected and the visible detail that ruled it out, e.g. 'Cayman — but the rear quarter windows and engine lid are 911.' '' if nothing was close.",
  },
  bodyStyle: { type: "string" },
  color: { type: "string" },
  countryOfOrigin: { type: "string" },
  engine: { type: "string", description: "Typical engine for this model/era" },
  drivetrain: { type: "string", description: "FWD/RWD/AWD etc." },
  horsepower: { type: "string" },
  zeroToSixty: { type: "string", description: "0-60 mph time, approx" },
  topSpeed: { type: "string" },
  priceRangeUsed: { type: "string", description: "Approx used market price range (USD)" },
  funFacts: {
    type: "array",
    items: { type: "string" },
    description: "Exactly 2 fun facts, each ONE short punchy sentence (max ~12 words). No preamble.",
  },
  confidence: { type: "string", enum: ["high", "medium", "low"] },
  notes: { type: "string", description: "Caveats, ambiguity, or '' if none." },
  parentCompany: {
    type: "string",
    description: "Corporate parent/group that owns the brand, e.g. 'Volkswagen Group' for Porsche.",
  },
  rarityScore: {
    type: "number",
    description:
      "How rare this car is: 0 (extremely common) to 100 (extremely rare). Reserve scores of 100 or above (up to 120) ONLY for the very rarest cars — genuine one-offs, prototypes, and sub-100-production hypercars/coachbuilt specials. These are 'ultra rare'.",
  },
  rarityReason: { type: "string", description: "One short sentence explaining the rarity score." },
  valueTimeline: {
    type: "array",
    description:
      "Approximate used-market value (USD) at exactly 4 points from when new to today. Ordered oldest to newest.",
    items: objSchema({
      year: { type: "string", description: "e.g. 'New (2018)' or '2024'" },
      usd: { type: "number", description: "approx value in USD" },
    }),
  },
  goodDealUsd: {
    type: "number",
    description: "USD price at or below which this car is clearly a good deal on the used market today.",
  },
  valuation: { type: "string", description: "One concise sentence: valuation + depreciation outlook." },
  reliability: { type: "string", description: "One concise sentence: reliability + the main common issue." },
  collectibility: { type: "string", description: "One concise sentence: collector/appreciation potential." },
});

const SECOND_OPINION_SCHEMA = objSchema({
  visualEvidence: EVIDENCE_PROP,
  zoomRegion: REGION_PROP,
  isCar: { type: "boolean" },
  ...IDENTITY_PROPS,
  confidence: { type: "string", enum: ["high", "medium", "low"] },
});

// The zoom pass reads one magnified detail. `legible` is separated out from the
// general evidence so a transcription ("R/T on the grille badge") can't get
// blurred together with an inference ("looks like a Charger").
const ZOOM_SCHEMA = objSchema({
  legible: {
    type: "string",
    description:
      "Transcribe EXACTLY the badge text, emblem or lettering you can actually read in this crop, character for character. Use '' if nothing is genuinely legible — never guess at blurred text.",
  },
  visualEvidence: EVIDENCE_PROP,
  ...IDENTITY_PROPS,
  confidence: { type: "string", enum: ["high", "medium", "low"] },
});

const ADJUDICATE_SCHEMA = objSchema({
  decidingDetail: {
    type: "string",
    description: "The one visible detail in the photo that settles it between the two candidates.",
  },
  ...IDENTITY_PROPS,
  confidence: { type: "string", enum: ["high", "medium", "low"] },
});

// --- Prompts -----------------------------------------------------------------

const GROUNDING =
  "Work from the photo, not from what is most common. Fill visualEvidence FIRST with details you can actually see, then let those details pick the car — a badge you can read outranks a silhouette that merely looks familiar. If a detail is too blurry or cropped to read, do not invent it. Then set zoomRegion to the one detail worth magnifying to confirm your answer; it will actually be cropped and re-read, so box the detail tightly rather than the whole car.";

const REPORT_PROMPT =
  "You are an expert automotive identifier. Identify this car as precisely as you can — make, model, year range, generation, and trim. " +
  GROUNDING +
  " Name the closest car you rejected in alsoConsidered. Set confidence honestly: 'high' only when a badge, a model-specific light signature, or an unmistakable body detail is legible. Keep every text field brief — short phrases, not paragraphs. Use '' for fields you truly cannot estimate. Always fill parentCompany, rarityScore (with a one-line rarityReason), a valueTimeline of exactly 4 points from new to today, and goodDealUsd (a realistic bargain price on the used market).";

const PROMPT_PREMIUM =
  " Also fill valuation, reliability, and collectibility — ONE concise sentence each, not paragraphs.";
const PROMPT_BASIC =
  " This is a standard request: leave valuation, reliability, and collectibility as ''.";

// Deliberately a different angle from the report pass: this one is told to build
// up from the hard parts (lights, glass, panel gaps) rather than the overall
// shape, so the two passes fail in different ways instead of the same way.
const SECOND_OPINION_PROMPT =
  "Identify the car in this photo. You are a second, independent opinion — no prior guess is given to you and you must not assume one. " +
  GROUNDING +
  " Start from the parts owners cannot change: headlight and taillight internals, grille and intake shapes, glasshouse and roofline, panel gaps, badge text, exhaust exits. Aftermarket wheels, wraps and body kits are unreliable — weight them low. Give make, model, year range, generation and trim as precisely as the visible detail allows, and set confidence honestly.";

const ZOOM_PROMPT =
  "This is a magnified crop of one detail from a car photo — the detail a previous look flagged as the one worth confirming. Read it literally. Transcribe any badge text, emblem or lettering into `legible` exactly as it appears, and leave `legible` empty rather than guessing at something too soft to read. The crop has been enlarged, so it is soft by nature: do not read detail into upscaling blur or JPEG artefacts. Then give the most precise identification this detail alone supports, and set confidence on that basis.";

const ADJUDICATE_PROMPT =
  "Two independent identifications of this same photo disagree. Look at the photo again yourself and settle it. Name the single visible detail that decides between them in decidingDetail, then give the identification you believe is correct — you may choose either candidate, or a third answer if both are wrong. Do not split the difference, and do not favour a candidate just because it sounds more confident.";

// --- API ---------------------------------------------------------------------

let client: Anthropic | null = null;
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new IdentifyError(
      "Server has no ANTHROPIC_API_KEY set. Add it to .env.local and restart.",
    );
  }
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

type ImageRef = { mediaType: string; base64Data: string };

async function ask<T>(opts: {
  images: ImageRef[];
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  effort: Effort;
}): Promise<T> {
  const send = (fast: boolean) =>
    getClient().beta.messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens,
      ...(fast ? { speed: "fast" as const, betas: ["fast-mode-2026-02-01"] } : {}),
      output_config: {
        ...(supportsEffort ? { effort: opts.effort } : {}),
        format: { type: "json_schema" as const, schema: opts.schema },
      },
      messages: [
        {
          role: "user",
          content: [
            ...opts.images.map((img) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: img.mediaType as "image/jpeg",
                data: img.base64Data,
              },
            })),
            { type: "text", text: opts.prompt },
          ],
        },
      ],
    });

  // Capture the mode this request actually used: passes run concurrently, so by
  // the time this one fails another may already have flipped the global flag —
  // gating the retry on `fastMode` would make the second failure fatal.
  const usedFast = fastMode;
  let res;
  try {
    res = await send(usedFast);
  } catch (e) {
    // Fast mode has its own rate limit and org entitlement. If it's unavailable,
    // fall back to standard speed for the life of the process rather than
    // failing every scan.
    if (usedFast && isFastModeProblem(e)) {
      fastMode = false;
      res = await send(false);
    } else {
      throw asIdentifyError(e);
    }
  }

  if (res.stop_reason === "refusal") {
    throw new IdentifyError("The model declined to analyse this image. Try a different photo.");
  }
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) {
    throw new IdentifyError(
      res.stop_reason === "max_tokens"
        ? "The model ran out of room before finishing the report."
        : "Model did not return a structured car report.",
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new IdentifyError("Model returned a malformed car report.");
  }
}

// --- Zoom --------------------------------------------------------------------

type Region = { x: number; y: number; w: number; h: number };

// The model's high-resolution ceiling. Blowing the crop back up to it is the
// whole point: the same badge pixels get the encoder's full attention instead of
// a couple of tokens' worth in the corner of a wide shot.
const ZOOM_TARGET_PX = 2576;
// A box tighter than this is almost always a mis-placed point rather than a real
// detail, and cropping to it yields mush. Widen it instead of trusting it.
const MIN_REGION = 0.08;
// Surrounding context — a badge is far easier to read with some bodywork around
// it than floating in a tight rectangle.
const REGION_PAD = 0.4;

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

// Pad, enforce a floor, and clamp back inside the frame. Returns null if the
// model gave us nothing usable — the caller then just skips the zoom.
function normalizeRegion(r: Region | undefined | null): Region | null {
  if (!r || !finite(r.x) || !finite(r.y) || !finite(r.w) || !finite(r.h)) return null;
  if (r.w <= 0 || r.h <= 0) return null;

  // Centre stays put while the box grows to its padded / minimum size.
  const grow = (start: number, size: number): [number, number] => {
    const centre = start + size / 2;
    const wanted = Math.min(1, Math.max(size * (1 + REGION_PAD), MIN_REGION));
    return [Math.min(Math.max(centre - wanted / 2, 0), 1 - wanted), wanted];
  };

  const [x, w] = grow(r.x, Math.min(r.w, 1));
  const [y, h] = grow(r.y, Math.min(r.h, 1));
  // A "zoom" covering nearly the whole frame is just the original image again.
  if (w > 0.9 && h > 0.9) return null;
  return { x, y, w, h };
}

// Crop the flagged detail out of the photo and enlarge it. Never throws: a
// failed crop degrades to "no zoom pass", which is the previous behaviour.
async function cropRegion(image: ImageRef, region: Region | undefined): Promise<ImageRef | null> {
  const r = normalizeRegion(region ?? null);
  if (!r) return null;
  try {
    const buf = Buffer.from(image.base64Data, "base64");
    const { width, height } = await sharp(buf).metadata();
    if (!width || !height) return null;

    const left = Math.round(r.x * width);
    const top = Math.round(r.y * height);
    // Guard the right/bottom edges against rounding pushing us past the image.
    const cw = Math.max(16, Math.min(Math.round(r.w * width), width - left));
    const ch = Math.max(16, Math.min(Math.round(r.h * height), height - top));

    const out = await sharp(buf)
      .extract({ left, top, width: cw, height: ch })
      .resize({ width: ZOOM_TARGET_PX, height: ZOOM_TARGET_PX, fit: "inside", withoutEnlargement: false, kernel: "lanczos3" })
      .jpeg({ quality: 92 })
      .toBuffer();

    return { mediaType: "image/jpeg", base64Data: out.toString("base64") };
  } catch {
    return null;
  }
}

// A magnified read plus the crop it was taken from — the crop is kept so the
// adjudicator can be shown the same detail rather than a description of it.
type Zoomed = { read: RawZoom | null; crop: ImageRef | null };
const NO_ZOOM: Zoomed = { read: null, crop: null };

// Never throws: a failed crop or a failed read costs the extra evidence, not the
// scan, and the caller falls back to deciding on the wide shot alone.
async function zoomOn(image: ImageRef, region: Region | undefined, note: string): Promise<Zoomed> {
  const crop = await cropRegion(image, region);
  if (!crop) return NO_ZOOM;
  try {
    const read = await ask<RawZoom>({
      images: [crop],
      prompt: ZOOM_PROMPT + note,
      schema: ZOOM_SCHEMA,
      maxTokens: 4000,
      // The crop exists precisely so the detail is big and obvious; reading it
      // does not need the deliberation that finding it in a wide shot did.
      effort: "medium",
    });
    return { read, crop };
  } catch (e) {
    console.warn("zoom pass failed:", e);
    return { read: null, crop };
  }
}

function isFastModeProblem(e: unknown): boolean {
  if (!(e instanceof Anthropic.APIError)) return false;
  if (e.status === 429) return true; // fast mode has a separate rate-limit pool
  const msg = String(e.message || "").toLowerCase();
  return e.status === 400 && (msg.includes("fast") || msg.includes("speed") || msg.includes("beta"));
}

function asIdentifyError(e: unknown): IdentifyError {
  if (e instanceof IdentifyError) return e;
  if (e instanceof Anthropic.RateLimitError) {
    return new IdentifyError("Too many scans right now — try again in a moment.");
  }
  if (e instanceof Anthropic.APIError) {
    return new IdentifyError(`Anthropic API error ${e.status}: ${String(e.message).slice(0, 300)}`);
  }
  return new IdentifyError("Identification failed.");
}

// --- Cross-check -------------------------------------------------------------

type Identity = {
  make: string;
  model: string;
  yearRange: string;
  generation: string;
  trimGuess: string;
};

const norm = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Two passes "agree" when they name the same marque and neither model name
// contradicts the other. "911" vs "911 Carrera 4S" is agreement; "911" vs
// "Cayman" is not.
function agrees(a: Identity, b: Identity): boolean {
  if (!norm(a.make) || !norm(b.make) || norm(a.make) !== norm(b.make)) return false;
  const ma = norm(a.model);
  const mb = norm(b.model);
  if (!ma || !mb) return false;
  return ma === mb || ma.startsWith(mb) || mb.startsWith(ma);
}

const RANK = { low: 0, medium: 1, high: 2 } as const;
type Conf = keyof typeof RANK;
const higher = (a: Conf, b: Conf): Conf => (RANK[a] >= RANK[b] ? a : b);
const lower = (a: Conf, b: Conf): Conf => (RANK[a] <= RANK[b] ? a : b);

// Prefer whichever pass was more specific about the year/generation/trim, so
// agreement doesn't throw away detail one of the two passes managed to read.
const richer = (a: string, b: string) => (a.trim().length >= b.trim().length ? a : b);

// Fold a corroborating look's detail into the running report. Only ever called
// once that look has been found to agree on make and model, so this refines the
// answer rather than changing it.
function absorb(
  out: CarReport,
  other: { yearRange?: string; generation?: string; trimGuess?: string; confidence?: string },
) {
  out.crossChecked = true;
  out.yearRange = richer(out.yearRange, other.yearRange ?? "");
  out.generation = richer(out.generation, other.generation ?? "");
  out.trimGuess = richer(out.trimGuess, other.trimGuess ?? "");
  out.confidence = higher(out.confidence, (other.confidence as Conf) ?? "low");
}

export async function identifyCar(
  mediaType: string,
  base64Data: string,
  premium: boolean,
  userText?: string,
): Promise<CarReport> {
  const image: ImageRef = { mediaType, base64Data };
  const note =
    userText && userText.trim()
      ? `\n\nThe spotter added a note: "${userText.trim()}". Treat it as a hint, not as fact — if the photo contradicts it, trust the photo.`
      : "";

  const secondP = ask<RawSecond>({
    images: [image],
    prompt: SECOND_OPINION_PROMPT + note,
    schema: SECOND_OPINION_SCHEMA,
    maxTokens: 4000,
    // Runs concurrently with the report, so it is free wall-clock only while it
    // stays the shorter of the two. It reads one car from one photo — cheap.
    effort: "low",
  });

  // The cheap look lands well before the report does. If it comes back anything
  // short of certain, start the close look on its chosen detail *now*, so the
  // zoom runs underneath the report instead of being tacked on after it. On a
  // hard car that turns an extra round trip into free wall-clock; on an easy one
  // the second opinion says "high" and no zoom is started or paid for.
  const earlyZoomP: Promise<Zoomed> = secondP
    .then((s) =>
      s.isCar && ((s.confidence as Conf) ?? "low") !== "high"
        ? zoomOn(image, s.zoomRegion, note)
        : NO_ZOOM,
    )
    .catch(() => NO_ZOOM);

  const [report, second] = await Promise.all([
    ask<RawReport>({
      images: [image],
      prompt: REPORT_PROMPT + (premium ? PROMPT_PREMIUM : PROMPT_BASIC) + note,
      schema: REPORT_SCHEMA,
      // Thinking and the answer share this budget, and the report pass is the
      // long one — leave room so a careful look never truncates the write-up.
      maxTokens: 12000,
      effort: REPORT_EFFORT,
    }),
    secondP,
  ]);

  const out = normalize(report);
  if (!out.isCar || !second.isCar) {
    out.crossChecked = true;
    out.crossCheckNote = out.isCar === second.isCar ? "Both passes agree there's no car here." : "";
    if (out.isCar !== second.isCar) {
      out.confidence = "low";
      out.crossCheckNote = "The two passes disagree on whether this is even a car.";
    }
    return out;
  }

  const a: Identity = report;
  const b: Identity = second;
  const unanimous = agrees(a, b);
  const bothCertain = out.confidence === "high" && ((second.confidence as Conf) ?? "low") === "high";

  // Two independent looks that agree AND are both certain have already settled
  // it; zooming would only confirm what a legible badge established twice.
  if (unanimous && bothCertain) {
    absorb(out, second);
    out.crossCheckNote = `Confirmed by a second independent look (${second.make} ${second.model}).`;
    return out;
  }

  // Usually already finished, having run alongside the report. Only when the
  // second opinion was certain but the report still left this contested do we
  // pay for a zoom here, on the report's own chosen detail.
  let zoomed = await earlyZoomP;
  if (!zoomed.read) zoomed = await zoomOn(image, report.zoomRegion ?? second.zoomRegion, note);
  const zoom = zoomed.read;
  const zoomImage = zoomed.crop;

  const read = zoom?.legible?.trim() ? ` — “${zoom.legible.trim()}” was legible up close` : "";

  if (unanimous) {
    absorb(out, second);
    if (!zoom || agrees(zoom, a)) {
      // Nothing contradicts the pair, so let the close look raise the ceiling.
      if (zoom) absorb(out, zoom);
      out.crossCheckNote = zoom
        ? `Two independent looks agreed, and zooming in confirmed it${read}.`
        : `Confirmed by a second independent look (${second.make} ${second.model}).`;
      return out;
    }
    // The magnified detail disagrees with both wide-shot looks — that is exactly
    // the case worth adjudicating, so fall through rather than trusting the pair.
  }

  // Disagreement: one more look, with the crop alongside the full photo.
  const images = zoomImage ? [image, zoomImage] : [image];
  const framing = zoomImage
    ? "\n\nYou are given two images: the full photo, then a magnified crop of the detail flagged as decisive."
    : "";
  const zoomLine = zoom
    ? `\n\nA magnified read of that detail said: ${describe(zoom)}${zoom.legible?.trim() ? ` (legible text: "${zoom.legible.trim()}")` : " (no legible text)"}.`
    : "";

  const verdict = await ask<Identity & { decidingDetail: string; confidence: Conf }>({
    images,
    prompt:
      `${ADJUDICATE_PROMPT}${framing}\n\nCandidate A: ${describe(a)}\nA's evidence: ${(report.visualEvidence || []).join("; ")}\n\nCandidate B: ${describe(b)}\nB's evidence: ${(second.visualEvidence || []).join("; ")}${zoomLine}${note}`,
    schema: ADJUDICATE_SCHEMA,
    maxTokens: 5000,
    effort: "medium",
  });

  const settled = agrees(verdict, a);
  out.crossChecked = true;
  // A contested ID is never "high" — two of three looks saw something different.
  out.confidence = lower(
    settled ? out.confidence : (verdict.confidence ?? "medium"),
    "medium",
  );
  out.crossCheckNote = settled
    ? `A second look suggested ${second.make} ${second.model}; a closer look confirmed this one — ${verdict.decidingDetail}${read}`
    : `The first look said ${a.make} ${a.model}; a closer look settled on this — ${verdict.decidingDetail}${read}`;

  if (!settled) {
    // The specs, facts and valuation in `out` describe the wrong car — the only
    // honest fix is to regenerate them against the identity that won.
    out.make = verdict.make;
    out.model = verdict.model;
    out.yearRange = verdict.yearRange;
    out.generation = verdict.generation;
    out.trimGuess = verdict.trimGuess;
    out.alsoConsidered = `${a.make} ${a.model} — rejected on a second look.`;

    const redo = await ask<RawReport>({
      images: [image],
      prompt:
        `${REPORT_PROMPT}${premium ? PROMPT_PREMIUM : PROMPT_BASIC}${note}\n\nThe car has already been identified as: ${describe(verdict)}. Take that identification as settled and do not change it — fill in the specs, facts, rarity and values for that exact car.`,
      schema: REPORT_SCHEMA,
      maxTokens: 12000,
      effort: REPORT_EFFORT,
    });
    const fixed = normalize(redo);
    return {
      ...fixed,
      make: verdict.make,
      model: verdict.model,
      yearRange: verdict.yearRange,
      generation: verdict.generation,
      trimGuess: verdict.trimGuess,
      confidence: out.confidence,
      crossChecked: true,
      crossCheckNote: out.crossCheckNote,
      alsoConsidered: out.alsoConsidered,
    };
  }

  return out;
}

const describe = (i: Identity) =>
  [i.yearRange, i.make, i.model, i.trimGuess, i.generation && `(${i.generation})`]
    .filter(Boolean)
    .join(" ");

type RawReport = Partial<CarReport> & Identity & { zoomRegion?: Region };
type RawSecond = Identity & {
  isCar?: boolean;
  confidence?: string;
  visualEvidence?: string[];
  zoomRegion?: Region;
};
type RawZoom = Identity & { legible?: string; confidence?: string; visualEvidence?: string[] };

function normalize(input: Partial<CarReport>): CarReport {
  return {
    isCar: !!input.isCar,
    make: input.make ?? "",
    model: input.model ?? "",
    yearRange: input.yearRange ?? "",
    generation: input.generation ?? "",
    trimGuess: input.trimGuess ?? "",
    bodyStyle: input.bodyStyle ?? "",
    color: input.color ?? "",
    countryOfOrigin: input.countryOfOrigin ?? "",
    engine: input.engine ?? "",
    drivetrain: input.drivetrain ?? "",
    horsepower: input.horsepower ?? "",
    zeroToSixty: input.zeroToSixty ?? "",
    topSpeed: input.topSpeed ?? "",
    priceRangeUsed: input.priceRangeUsed ?? "",
    funFacts: Array.isArray(input.funFacts) ? input.funFacts : [],
    confidence: (input.confidence as CarReport["confidence"]) ?? "low",
    notes: input.notes ?? "",
    parentCompany: input.parentCompany ?? "",
    rarityScore: typeof input.rarityScore === "number" ? input.rarityScore : 0,
    rarityReason: input.rarityReason ?? "",
    valueTimeline: Array.isArray(input.valueTimeline) ? input.valueTimeline : [],
    goodDealUsd: typeof input.goodDealUsd === "number" ? input.goodDealUsd : 0,
    valuation: input.valuation ?? "",
    reliability: input.reliability ?? "",
    collectibility: input.collectibility ?? "",
    visualEvidence: Array.isArray(input.visualEvidence) ? input.visualEvidence : [],
    alsoConsidered: input.alsoConsidered ?? "",
    crossChecked: false,
    crossCheckNote: "",
  };
}

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
import type { ScanMode } from "./scan-mode";
import { normalizeVin, checkDigitPasses } from "./vin";

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

const DEFAULT_MODEL = "claude-sonnet-5";

// This pipeline depends on structured outputs, so an override naming a model
// without them would 400 on every scan. Honour the env var only when it names a
// model that can actually run this, and otherwise fall back rather than break
// spotting for a value nobody remembers setting.
const STRUCTURED_OUTPUT_CAPABLE =
  /^claude-(opus-(5|4-8)|sonnet-5|haiku-4-5|(fable|mythos)-5(-1)?)$/;

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

// Measured, and it surprised me: putting the wide-shot looks on Sonnet 5 made
// scans *slower* — median 19.6s against 10.0s — because the cheaper look
// disagreed with the second opinion 8 times in 9 instead of 1, and every
// disagreement buys an Opus adjudication that dwarfs what the faster look saved.
// It also named cars less precisely ("911 Carrera" for a "911 Carrera S").
// The same trap as low effort: on a pipeline whose accuracy comes from
// agreement, anything that cheapens a look pays for it twice over.
// Left as an override so the experiment is one env var away, not a deploy.
const LOOK_MODEL = (() => {
  const override = process.env.CAR_SPOTTER_LOOK_MODEL?.trim();
  if (override && STRUCTURED_OUTPUT_CAPABLE.test(override)) return override;
  return MODEL;
})();

// The spec sheet is pure recall — no photo, no second opinion, no adjudicator.
// That matters: the reason a cheaper model backfired on the wide looks was the
// disagreement it caused and the adjudication that followed, and none of that
// machinery exists on this call. There is nothing here for a smaller model to
// destabilise, so it takes the cheapest one while spotting does not.
const SPECS_MODEL = (() => {
  const override = process.env.CAR_SPOTTER_SPECS_MODEL?.trim();
  if (override && STRUCTURED_OUTPUT_CAPABLE.test(override)) return override;
  return "claude-haiku-4-5";
})();

// Fast mode runs the same model at up to 2.5x output speed. Only Opus 5 / 4.8
// support it, so any other model silently runs at standard speed — including
// Fable, which is now the default. Left in place for a CAR_SPOTTER_MODEL
// override pointing back at Opus.
const FAST_CAPABLE = /^claude-opus-(5|4-8)$/;

// Server-side fallbacks route a refused request to another model. Offered on
// the frontier models, where a safety classifier declining is a real outcome —
// sending the parameter to a model that doesn't take it is a 400, so it is
// gated rather than sent to whatever the override names.
const FALLBACK_CAPABLE = /^claude-(opus-(5|4-8)|(fable|mythos)-5(-1)?)$/;

// Fable and Mythos think on every request and reject being told otherwise:
// `thinking: {type: "disabled"}` is a 400, not a no-op. So the passes that used
// to switch thinking off to save the spotter a few seconds simply cannot on
// these models — they ask for low effort instead, which is the supported way to
// buy the same thing.
const THINKING_ALWAYS_ON = /^claude-(fable|mythos)-5(-1)?$/;
let fastMode = process.env.CAR_SPOTTER_FAST !== "0";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

// This one call is the entire wait: the second opinion and the zoom run beside
// it, and the spec sheet runs after the answer is already on screen. So effort
// here is the latency dial, and it is set low deliberately. Accuracy no longer
// rests on this pass thinking longer — it rests on an independent second look,
// a magnified read of the deciding detail, and an adjudicator that sees both.
// Measured: dropping this to `low` moved the median barely at all and made the
// two looks disagree noticeably more often, and a disagreement costs an
// adjudication that dwarfs whatever the cheaper look saved. `medium` is the
// floor that pays for itself. CAR_SPOTTER_EFFORT overrides it.
const LOOK_EFFORT = (process.env.CAR_SPOTTER_EFFORT as Effort) || "medium";

// `effort` is rejected outright by Haiku 4.5 and Sonnet 4.5, so a
// CAR_SPOTTER_MODEL override pointing at one of those must not send it.
const EFFORT_CAPABLE =
  /^claude-(opus-(5|4-8|4-7|4-6|4-5)|sonnet-(5|4-6)|(fable|mythos)-5(-1)?)$/;

export class IdentifyError extends Error {}

export type { ScanMode };

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
    "2-3 short notes on what is literally visible in THIS photo and led you to the answer: badge text, grille shape, headlight/taillight signature, wheel design, mirror and door-handle style, roofline, exhaust layout. Observations only — no conclusions.",
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

// What the photo can answer. Kept deliberately small: this is the call a spotter
// is actually waiting on, and every field here is one more thing to write before
// they see the car's name.
// Evidence is listed first so the model records what it sees before naming the car.
const LOOK_SCHEMA = objSchema({
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
  confidence: { type: "string", enum: ["high", "medium", "low"] },
  notes: { type: "string", description: "Caveats, ambiguity, or '' if none." },
});

// What the photo is irrelevant to. Once the car has a name these are recall, not
// perception, so they run without the image and off the critical path.
const SPECS_SCHEMA = objSchema({
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

const NO_MARKUP = " Do not include internal or system XML tags in your response.";

const GROUNDING =
  "Work from the photo, not from what is most common. Fill visualEvidence FIRST with details you can actually see, then let those details pick the car — a badge you can read outranks a silhouette that merely looks familiar. If a detail is too blurry or cropped to read, do not invent it. Then set zoomRegion to the one detail worth magnifying to confirm your answer; it will actually be cropped and re-read, so box the detail tightly rather than the whole car.";

const LOOK_PROMPT =
  "You are an expert automotive identifier. Identify this car as precisely as you can — make, model, year range, generation, and trim. " +
  GROUNDING +
  " Name the closest car you rejected in alsoConsidered. Set confidence honestly: 'high' only when a badge, a model-specific light signature, or an unmistakable body detail is legible. Answer ONLY what the photo shows — identity, body style and colour. Do not describe specs, performance, rarity or value; another pass handles those. Keep every text field brief." + NO_MARKUP;

// No image: by this point the car has a name, and engine, performance, rarity
// and value are recall rather than perception. Running it without the photo
// keeps it off the path the spotter is waiting on.
const SPECS_PROMPT =
  "Give the standard specification and market picture for a car that has ALREADY been identified. Do not question or revise the identification — it was made from a photo you cannot see. Keep every text field brief: short phrases, not paragraphs, and '' for anything you genuinely cannot estimate. Always fill parentCompany, rarityScore (with a one-line rarityReason), a valueTimeline of exactly 4 points from new to today, and goodDealUsd (a realistic bargain price on the used market).";

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
  " Start from the parts owners cannot change: headlight and taillight internals, grille and intake shapes, glasshouse and roofline, panel gaps, badge text, exhaust exits. Aftermarket wheels, wraps and body kits are unreliable — weight them low. Give make, model, year range, generation and trim as precisely as the visible detail allows, and set confidence honestly." + NO_MARKUP;

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
  model?: string;
  think?: boolean;
}): Promise<T> {
  const model = opts.model ?? MODEL;
  const supportsEffort = EFFORT_CAPABLE.test(model);
  const supportsFallbacks = FALLBACK_CAPABLE.test(model);
  // Thinking is emitted before a single character of the answer, so switching it
  // off used to be the one remaining way to shorten the call the spotter waits
  // on. Only honoured where the model actually accepts it: on Fable the same
  // request is a 400, so the flag is dropped rather than passed through.
  const think = opts.think !== false || THINKING_ALWAYS_ON.test(model);
  const send = (fast: boolean) =>
    getClient().beta.messages.create({
      model,
      max_tokens: opts.maxTokens,
      // Server-side fallbacks: a safety classifier can decline a request, and a
      // refusal would otherwise surface as a failed scan. "default" lets the
      // server route by refusal category rather than us maintaining a model list.
      ...(supportsFallbacks
        ? {
            betas: fast
              ? (["server-side-fallback-2026-07-01", "fast-mode-2026-02-01"] as const)
              : (["server-side-fallback-2026-07-01"] as const),
            fallbacks: "default" as const,
          }
        : fast
          ? { betas: ["fast-mode-2026-02-01" as const] }
          : {}),
      ...(fast ? { speed: "fast" as const } : {}),
      ...(think ? {} : { thinking: { type: "disabled" as const } }),
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
  // Fast mode is an Opus-only research preview; anything else runs standard.
  const usedFast = fastMode && FAST_CAPABLE.test(model);
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

// Wide enough to place a car, read its shape and pick a detail to magnify —
// roughly a quarter of the image tokens of the full-resolution original, which
// is time paid twice over since both wide-shot passes prefill it.
const WIDE_PX = 1280;

// Falls back to the original on any failure: a slower scan beats a failed one.
async function shrink(image: ImageRef): Promise<ImageRef | null> {
  try {
    const buf = Buffer.from(image.base64Data, "base64");
    const { width, height } = await sharp(buf).metadata();
    if (!width || !height) return null;
    if (Math.max(width, height) <= WIDE_PX) return null; // already small
    const out = await sharp(buf)
      .resize({ width: WIDE_PX, height: WIDE_PX, fit: "inside", kernel: "lanczos3" })
      .jpeg({ quality: 90 })
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
      model: LOOK_MODEL,
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
  userText?: string,
  mode: ScanMode = "precise",
): Promise<CarReport> {
  const image: ImageRef = { mediaType, base64Data };
  // Both wide-shot passes prefill this photo, and at 2576px that is the single
  // biggest fixed cost in the scan. They don't need it: their job is to place
  // the car and pick the detail worth magnifying. The zoom is what reads the
  // badge, and it still crops from the full-resolution original — so the detail
  // is preserved exactly where it gets used.
  const wide = (await shrink(image)) ?? image;
  const note =
    userText && userText.trim()
      ? `\n\nThe spotter added a note: "${userText.trim()}". Treat it as a hint, not as fact — if the photo contradicts it, trust the photo.`
      : "";

  // Fast mode stops here: one wide-shot look, no second opinion, no zoom, no
  // adjudication. That is one model call against up to four, so it returns in
  // roughly the time the first look alone takes. What it gives up is precisely
  // the machinery that rescues a contested car — so it can't claim `high`
  // confidence off a single unchecked pass, and says so rather than implying a
  // cross-check that never ran.
  if (mode === "fast") {
    const report = await ask<RawLook>({
      images: [wide],
      model: LOOK_MODEL,
      think: false,
      prompt: LOOK_PROMPT + note,
      schema: LOOK_SCHEMA,
      maxTokens: 6000,
      effort: LOOK_EFFORT,
    });
    const out = normalize(report);
    out.crossChecked = false;
    out.crossCheckNote = out.isCar
      ? "Fast scan — one look, not cross-checked. Switch to Precise in settings for the full check."
      : "";
    return out;
  }

  const secondP = ask<RawSecond>({
    images: [wide],
    model: LOOK_MODEL,
    think: false,
    prompt: SECOND_OPINION_PROMPT + note,
    schema: SECOND_OPINION_SCHEMA,
    maxTokens: 4000,
    // Runs concurrently with the report, so it is free wall-clock only while it
    // stays the shorter of the two. It reads one car from one photo — cheap.
    effort: "low",
  });

  // The cheap look lands well before the report does, so the close look on its
  // chosen detail starts *now* and runs underneath the report. We can't yet know
  // whether the report will contest it, and finding out first is what used to
  // cost a serial round trip — so it always runs. The read is discarded unused
  // on a car the two passes agree on, which buys the contested case its speed at
  // the price of one small call on the easy ones.
  const earlyZoomP: Promise<Zoomed> = secondP
    .then((s) => (s.isCar ? zoomOn(image, s.zoomRegion, note) : NO_ZOOM))
    .catch(() => NO_ZOOM);

  const [report, second] = await Promise.all([
    ask<RawLook>({
      images: [wide],
      model: LOOK_MODEL,
      think: false,
      prompt: LOOK_PROMPT + note,
      schema: LOOK_SCHEMA,
      maxTokens: 6000,
      effort: LOOK_EFFORT,
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
  const images = zoomImage ? [wide, zoomImage] : [wide];
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
    // Nothing to regenerate any more: the specs are written later, from whatever
    // identity wins here. Overriding the name is the whole fix.
    out.make = verdict.make;
    out.model = verdict.model;
    out.yearRange = verdict.yearRange;
    out.generation = verdict.generation;
    out.trimGuess = verdict.trimGuess;
    out.alsoConsidered = `${a.make} ${a.model} — rejected on a second look.`;
  }

  return out;
}

// The other half of a report: everything that follows from the car's name rather
// than from the photo. No image, so the input is a fraction of the size, and it
// runs after the spotter already has their answer on screen.
export async function describeCar(
  identity: Identity,
  premium: boolean,
): Promise<Partial<CarReport>> {
  const specs = await ask<Partial<CarReport>>({
    images: [],
    prompt: `${SPECS_PROMPT}${premium ? PROMPT_PREMIUM : PROMPT_BASIC}\n\nThe car is: ${describe(identity)}.`,
    schema: SPECS_SCHEMA,
    model: SPECS_MODEL,
    maxTokens: 6000,
    // Recall, not perception — it does not need to deliberate over a photo.
    effort: "low",
    think: false,
  });
  return {
    countryOfOrigin: specs.countryOfOrigin ?? "",
    engine: specs.engine ?? "",
    drivetrain: specs.drivetrain ?? "",
    horsepower: specs.horsepower ?? "",
    zeroToSixty: specs.zeroToSixty ?? "",
    topSpeed: specs.topSpeed ?? "",
    priceRangeUsed: specs.priceRangeUsed ?? "",
    funFacts: Array.isArray(specs.funFacts) ? specs.funFacts : [],
    parentCompany: specs.parentCompany ?? "",
    rarityScore: typeof specs.rarityScore === "number" ? specs.rarityScore : 0,
    rarityReason: specs.rarityReason ?? "",
    valueTimeline: Array.isArray(specs.valueTimeline) ? specs.valueTimeline : [],
    goodDealUsd: typeof specs.goodDealUsd === "number" ? specs.goodDealUsd : 0,
    valuation: specs.valuation ?? "",
    reliability: specs.reliability ?? "",
    collectibility: specs.collectibility ?? "",
  };
}

const describe = (i: Identity) =>
  [i.yearRange, i.make, i.model, i.trimGuess, i.generation && `(${i.generation})`]
    .filter(Boolean)
    .join(" ");

type RawLook = Partial<CarReport> & Identity & { zoomRegion?: Region };
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

// --- VIN ---------------------------------------------------------------------
//
// Reading a VIN is a different problem from identifying a car. There is no
// shape to recognise and nothing to reason about — there are seventeen stamped
// characters, and the entire task is transcribing them without a single slip,
// because one wrong character is a different vehicle.
//
// Two things make that reliable. The plate is tiny in a phone photo, so the
// first pass boxes it and a second pass reads a magnified crop of just that box
// — the same trick that reads badges, and it matters far more here. And the
// answer is checkable: position 9 is a checksum over the other sixteen, so a
// read either verifies arithmetically or it doesn't, and the passes stop as
// soon as one does.

export type VinRead = {
  found: boolean;
  vin: string;
  /** Where on the car it was read — dash plate, door jamb, engine bay, paperwork. */
  surface: string;
  legibility: "high" | "medium" | "low";
  notes: string;
  /** True when the returned VIN's own check digit computes. */
  verified: boolean;
};

const VIN_PROPS = {
  found: {
    type: "boolean",
    description: "True only if you can actually see VIN characters in this image.",
  },
  vin: {
    type: "string",
    description:
      "The 17 characters exactly as stamped, left to right, no spaces or punctuation. Empty string if you cannot see a VIN at all.",
  },
  surface: {
    type: "string",
    description:
      "Where it is written: 'dashboard plate through the windscreen', 'driver door jamb sticker', 'engine bay stamp', 'chassis stamp', 'registration document', etc.",
  },
  legibility: {
    type: "string",
    enum: ["high", "medium", "low"],
    description:
      "high = every character is crisply readable. medium = readable but some characters are soft. low = you are partly guessing.",
  },
  notes: {
    type: "string",
    description:
      "Which character positions, if any, you are unsure of and what they might otherwise be. '' if the read is clean.",
  },
} as const;

const VIN_LOCATE_SCHEMA = objSchema({
  ...VIN_PROPS,
  zoomRegion: {
    ...objSchema({
      x: { type: "number", description: "Left edge, 0-1 across the width." },
      y: { type: "number", description: "Top edge, 0-1 down the height." },
      w: { type: "number", description: "Width as a fraction of the image width." },
      h: { type: "number", description: "Height as a fraction of the image height." },
    }),
    description:
      "A tight box around the VIN characters themselves — the plate or sticker, not the whole dashboard or door. It will be cropped and enlarged to read the characters properly.",
  },
});

const VIN_READ_SCHEMA = objSchema(VIN_PROPS);

// The alphabet rule is the single most useful thing to tell the model: a VIN
// physically cannot contain I, O or Q, so those readings are always something
// else and it should say which.
const VIN_RULES =
  " A VIN is exactly 17 characters and NEVER contains the letters I, O or Q — if a character looks like one of those it is a 1 or a 0. Transcribe what is stamped, character by character; do not tidy it up, do not skip a character, and do not pad it out to 17 if you can only see fewer. If part of it is out of frame or unreadable, say so in notes rather than inventing the missing characters.";

const VIN_LOCATE_PROMPT =
  "Find the Vehicle Identification Number in this photo and transcribe it. It is usually on a small plate at the base of the windscreen on the driver's side, on a sticker in the driver's door jamb, stamped in the engine bay or on the chassis, or printed on registration paperwork." +
  VIN_RULES +
  " Then set zoomRegion tightly around the characters so they can be magnified and checked." +
  NO_MARKUP;

const VIN_ZOOM_PROMPT =
  "This is a magnified crop of a VIN plate. Read the 17 characters off it, one at a time, left to right." +
  VIN_RULES +
  " The crop has been enlarged so it is soft by nature — read the stamped characters, not the upscaling blur." +
  NO_MARKUP;

/**
 * Read the VIN out of a photo.
 *
 * The wide pass locates and transcribes; if what it returns doesn't verify
 * against its own check digit, the flagged region is cropped, enlarged and read
 * again. A verified read wins outright — it is the only outcome that is
 * self-proving — and past that a 17-character zoom read beats a wide one,
 * because the zoom is looking at characters the wide pass saw as a smudge.
 */
export async function readVin(mediaType: string, base64Data: string): Promise<VinRead> {
  const image: ImageRef = { mediaType, base64Data };

  const wide = await ask<VinRead & { zoomRegion?: Region }>({
    images: [image],
    model: LOOK_MODEL,
    prompt: VIN_LOCATE_PROMPT,
    schema: VIN_LOCATE_SCHEMA,
    maxTokens: 3000,
    // Transcription, not deliberation. The accuracy here comes from magnifying
    // the plate, not from thinking longer about a blurry one.
    effort: "medium",
  });

  const wideRead = settle(wide);
  if (wideRead.verified) return wideRead;

  // Worth a crop even when the wide pass saw nothing: a VIN it missed entirely
  // is usually one that was too small to register, and there is no region to
  // crop to in that case, so this simply falls through.
  const crop = await cropRegion(image, wide.zoomRegion);
  if (!crop) return wideRead;

  let zoomRead: VinRead;
  try {
    zoomRead = settle(
      await ask<VinRead>({
        images: [crop],
        model: LOOK_MODEL,
        prompt: VIN_ZOOM_PROMPT,
        schema: VIN_READ_SCHEMA,
        maxTokens: 3000,
        effort: "medium",
      }),
    );
  } catch (e) {
    console.warn("VIN zoom pass failed:", e);
    return wideRead;
  }

  if (zoomRead.verified) return zoomRead;
  // Neither verifies. Prefer whichever actually produced 17 characters, and the
  // magnified one when both did.
  if (zoomRead.vin.length === 17) return zoomRead;
  if (wideRead.vin.length === 17) return wideRead;
  return zoomRead.vin.length >= wideRead.vin.length ? zoomRead : wideRead;
}

/** Normalise the model's raw transcription and mark whether it proves itself. */
function settle(raw: Partial<VinRead>): VinRead {
  const vin = normalizeVin(raw.vin ?? "");
  return {
    found: !!raw.found && vin.length > 0,
    vin,
    surface: raw.surface ?? "",
    legibility: (raw.legibility as VinRead["legibility"]) ?? "low",
    notes: raw.notes ?? "",
    verified: checkDigitPasses(vin),
  };
}

// What the VIN itself has already settled. The model is handed these rather
// than asked for them, so it can't overwrite arithmetic with a hunch.
export type VinKnown = {
  vin: string;
  manufacturer: string;
  country: string;
  modelYear: number | null;
  /** vPIC's answer, when it had one — treated as ground truth, not a suggestion. */
  registry?: {
    make: string;
    model: string;
    modelYear: string;
    series: string;
    trim: string;
    bodyClass: string;
    driveType: string;
    engine: string;
  } | null;
};

const VIN_DECODE_SCHEMA = objSchema({
  ...IDENTITY_PROPS,
  isCar: { type: "boolean", description: "True unless this VIN belongs to something that isn't a car." },
  bodyStyle: { type: "string" },
  confidence: { type: "string", enum: ["high", "medium", "low"] },
  notes: {
    type: "string",
    description:
      "One short sentence on what the VIN could and couldn't pin down — trim especially. '' if nothing is worth caveating.",
  },
});

const VIN_DECODE_PROMPT =
  "Identify the exact vehicle this VIN belongs to. Characters 4 to 8 are the manufacturer's own vehicle descriptor section — decode them using what you know of that manufacturer's scheme for that era. " +
  "The manufacturer, country and model year below were computed from the VIN arithmetically and are not in question: never contradict them, and never name a model the stated manufacturer does not build. " +
  "Where an authoritative registry decode is given, treat its make, model and year as correct and add only what it left out. " +
  "Set trimGuess only if the descriptor section genuinely encodes it — a VIN often does not, and '' is the honest answer. " +
  "Set confidence on how specifically the VIN identifies the car: 'high' when the descriptor section pins the model, 'low' when you are reasoning from the manufacturer and year alone." +
  NO_MARKUP;

/**
 * Turn a decoded VIN into a car.
 *
 * No image is involved: by this point the VIN has been read and verified, and
 * naming the vehicle is recall over the manufacturer's descriptor scheme. The
 * arithmetic facts and the registry lookup are passed in as settled, so this
 * pass fills the gaps between them rather than re-deriving what is already known.
 */
export async function decodeVinToCar(known: VinKnown): Promise<CarReport> {
  const r = known.registry;
  const facts = [
    `VIN: ${known.vin}`,
    known.manufacturer && `Manufacturer (from the WMI): ${known.manufacturer}`,
    known.country && `Assembled in: ${known.country}`,
    known.modelYear && `Model year (from position 10): ${known.modelYear}`,
    r && `Registry decode — make: ${r.make || "?"}, model: ${r.model || "?"}, year: ${r.modelYear || "?"}, series: ${r.series || "?"}, trim: ${r.trim || "?"}, body: ${r.bodyClass || "?"}, drive: ${r.driveType || "?"}, engine: ${r.engine || "?"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const out = await ask<Partial<CarReport>>({
    images: [],
    prompt: `${VIN_DECODE_PROMPT}\n\n${facts}`,
    schema: VIN_DECODE_SCHEMA,
    model: SPECS_MODEL,
    maxTokens: 3000,
    effort: "low",
    think: false,
  });

  const car = normalize({ ...out, isCar: out.isCar !== false });

  // The registry and the arithmetic outrank the model on the fields they cover,
  // whatever it wrote. Applied after normalisation so an empty registry field
  // can't blank out an answer the model did have.
  if (r?.make) car.make = r.make;
  if (r?.model) car.model = r.model;
  if (r?.trim && !car.trimGuess) car.trimGuess = r.trim;
  if (r?.bodyClass && !car.bodyStyle) car.bodyStyle = r.bodyClass;
  const year = r?.modelYear || (known.modelYear ? String(known.modelYear) : "");
  if (year) car.yearRange = year;
  if (!car.make && known.manufacturer) car.make = known.manufacturer;

  // Evidence, for the same reason a photo scan shows its working: it should be
  // visible that this came off the plate rather than out of a guess.
  car.visualEvidence = [
    `VIN ${known.vin} read off the vehicle`,
    known.manufacturer && `Characters 1-3 (${known.vin.slice(0, 3)}) are ${known.manufacturer}`,
    known.modelYear && `Character 10 (${known.vin[9]}) is model year ${known.modelYear}`,
    r?.make ? "Confirmed against the NHTSA vPIC registry" : "",
  ].filter((s): s is string => !!s);

  return car;
}

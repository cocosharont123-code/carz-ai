import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Fable thinks on every request and is the slowest model in the lineup.
export const maxDuration = 120;

// Recall, not vision — the same reasoning as the spec sheet in identify.ts.
// On Fable like everything else now; effort is pinned low below, and
// CAR_DROPS_MODEL puts it back on a cheaper model without a deploy.
const MODEL = process.env.CAR_DROPS_MODEL || "claude-fable-5-1";

/** Floor for what counts as a drop worth listing here. */
export const MIN_PRICE_USD = 120_000;

const CATEGORIES = ["Hypercar", "Supercar", "Luxury"] as const;

export type Drop = {
  make: string;
  model: string;
  category: (typeof CATEGORIES)[number];
  startingPriceUsd: number;
  status: string;
  timing: string;
  powertrain: string;
  headline: string;
  note: string;
};

const TOOL = {
  name: "report_drops",
  description: "Report newly launched or newly announced high-end cars.",
  input_schema: {
    type: "object",
    properties: {
      drops: {
        type: "array",
        description: "10–16 genuinely new high-end car launches or announcements.",
        items: {
          type: "object",
          properties: {
            make: { type: "string" },
            model: { type: "string", description: "Model and trim as marketed, e.g. '911 GT3 RS'." },
            category: { type: "string", enum: [...CATEGORIES] },
            startingPriceUsd: {
              type: "number",
              description:
                "Published starting MSRP in USD, before options. Must be at least 120000. Use your best published figure; if no price has been announced, give your best-documented estimate and say so in `note`.",
            },
            status: {
              type: "string",
              enum: ["Revealed", "Order books open", "Deliveries begun"],
            },
            timing: {
              type: "string",
              description:
                "When it landed or lands, as a year or season — e.g. '2026' or 'Late 2026'. Never invent an exact calendar date.",
            },
            powertrain: {
              type: "string",
              description: "Short, e.g. 'Twin-turbo V8 hybrid' or 'Quad-motor EV'.",
            },
            headline: {
              type: "string",
              description: "The one number that defines it, e.g. '1,250 hp' or '0–60 in 2.1s'.",
            },
            note: { type: "string", description: "One short line on why it matters." },
          },
          required: [
            "make",
            "model",
            "category",
            "startingPriceUsd",
            "status",
            "timing",
            "powertrain",
            "headline",
            "note",
          ],
        },
      },
    },
    required: ["drops"],
  },
} as const;

const PROMPT =
  "List 10 to 16 genuinely new high-end car drops — models revealed, opened for order, or entering customer deliveries most recently. " +
  `Only cars with a starting MSRP of at least $${MIN_PRICE_USD.toLocaleString("en-US")} USD, and only hypercars, supercars, or luxury cars (grand tourers, luxury saloons, luxury SUVs, ultra-luxury coachbuilt). ` +
  "Exclude anything below that price, ordinary mass-market cars, and models that have been on sale unchanged for years. " +
  "Prefer real, verifiable, publicly announced cars from manufacturers that actually exist, and give prices as published rather than guessed. " +
  "Spread the list across several manufacturers rather than filling it with one brand's range. " +
  "Give timing as a year or season — never an invented exact date.";

// One warm-instance cache. This list moves on the scale of weeks, so re-asking
// the model on every page view would be pure cost for an identical answer.
// Serverless gives no shared cache, so a cold instance simply refetches.
const TTL_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; drops: Drop[] } | null = null;

function isValid(d: unknown): d is Drop {
  const x = d as Partial<Drop>;
  return (
    !!x &&
    typeof x.make === "string" &&
    x.make.trim().length > 0 &&
    typeof x.model === "string" &&
    x.model.trim().length > 0 &&
    typeof x.startingPriceUsd === "number" &&
    Number.isFinite(x.startingPriceUsd) &&
    // Enforced here rather than trusted to the prompt: the floor is the whole
    // point of the section, and a model that drifts under it would quietly
    // turn this into a list of ordinary cars.
    x.startingPriceUsd >= MIN_PRICE_USD &&
    typeof x.category === "string" &&
    (CATEGORIES as readonly string[]).includes(x.category)
  );
}

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { configured: false, drops: [], error: "Server has no ANTHROPIC_API_KEY." },
      { status: 200 },
    );
  }

  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({ configured: true, drops: cache.drops, cached: true });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        // Thinking tokens come out of this budget, and on Fable thinking cannot
        // be switched off.
        max_tokens: 12000,
        // Recall, not reasoning — low effort keeps an always-thinking model brief.
        output_config: { effort: "low" },
        tools: [TOOL],
        tool_choice: { type: "tool", name: "report_drops" },
        messages: [{ role: "user", content: PROMPT }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { configured: true, drops: [], error: "Couldn't load new drops." },
        { status: 502 },
      );
    }

    const data = await res.json();
    const block = (data.content || []).find(
      (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "report_drops",
    );

    const drops: Drop[] = (block?.input?.drops ?? [])
      .filter(isValid)
      .sort((a: Drop, b: Drop) => b.startingPriceUsd - a.startingPriceUsd);

    // Don't cache an empty answer — that would pin a bad run for six hours.
    if (drops.length > 0) cache = { at: Date.now(), drops };

    return NextResponse.json({ configured: true, drops });
  } catch {
    return NextResponse.json(
      { configured: true, drops: [], error: "Couldn't reach the model." },
      { status: 502 },
    );
  }
}

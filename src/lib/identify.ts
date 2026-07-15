// Server-side car identification via the Claude vision API.

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
};

// Haiku 4.5 identifies cars nearly as well as Sonnet but generates the report
// several times faster. Override with CAR_SPOTTER_MODEL to trade speed for depth.
const MODEL = process.env.CAR_SPOTTER_MODEL || "claude-haiku-4-5-20251001";

const CAR_TOOL = {
  name: "report_car",
  description: "Report everything identifiable about the car in the image.",
  input_schema: {
    type: "object",
    properties: {
      isCar: { type: "boolean", description: "True if a car/vehicle is clearly visible." },
      make: { type: "string" },
      model: { type: "string" },
      yearRange: { type: "string", description: "e.g. '2018-2021' or '2020'" },
      generation: { type: "string", description: "Generation/chassis code if known, else ''" },
      trimGuess: { type: "string", description: "Best-guess trim, or '' if unsure" },
      bodyStyle: { type: "string" },
      color: { type: "string" },
      countryOfOrigin: { type: "string" },
      engine: { type: "string", description: "Typical engine for this model/era" },
      drivetrain: { type: "string", description: "FWD/RWD/AWD etc." },
      horsepower: { type: "string" },
      zeroToSixty: { type: "string", description: "0-60 mph time, approx" },
      topSpeed: { type: "string" },
      priceRangeUsed: { type: "string", description: "Approx used market price range (USD)" },
      funFacts: { type: "array", items: { type: "string" }, description: "Exactly 2 fun facts, each ONE short punchy sentence (max ~12 words). No preamble." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      notes: { type: "string", description: "Caveats, ambiguity, or '' if none." },
      parentCompany: { type: "string", description: "Corporate parent/group that owns the brand, e.g. 'Volkswagen Group' for Porsche." },
      rarityScore: { type: "number", description: "How rare this car is: 0 (extremely common) to 100 (extremely rare). Reserve scores of 100 or above (up to 120) ONLY for the very rarest cars — genuine one-offs, prototypes, and sub-100-production hypercars/coachbuilt specials. These are 'ultra rare'." },
      rarityReason: { type: "string", description: "One short sentence explaining the rarity score." },
      valueTimeline: {
        type: "array",
        description: "Approximate used-market value (USD) at exactly 4 points from when new to today. Ordered oldest to newest.",
        items: {
          type: "object",
          properties: {
            year: { type: "string", description: "e.g. 'New (2018)' or '2024'" },
            usd: { type: "number", description: "approx value in USD" },
          },
          required: ["year", "usd"],
        },
      },
      goodDealUsd: { type: "number", description: "USD price at or below which this car is clearly a good deal on the used market today." },
      valuation: { type: "string", description: "One concise sentence: valuation + depreciation outlook." },
      reliability: { type: "string", description: "One concise sentence: reliability + the main common issue." },
      collectibility: { type: "string", description: "One concise sentence: collector/appreciation potential." },
    },
    required: ["isCar", "make", "model", "confidence"],
  },
} as const;

const PROMPT_BASE =
  "You are an expert automotive identifier. Look at the photo and identify the car as precisely as you can, then call report_car with your best assessment. If unsure of the exact model, give your single best guess and set confidence accordingly. Keep every text field brief — short phrases, not paragraphs. Fill fields you reasonably can; use '' for fields you truly cannot estimate. Always fill parentCompany, rarityScore (with a one-line rarityReason), a valueTimeline of exactly 4 points from new to today, and goodDealUsd (a realistic bargain price on the used market).";
const PROMPT_PREMIUM =
  " Also fill valuation, reliability, and collectibility — ONE concise sentence each, not paragraphs.";
const PROMPT_BASIC =
  " This is a standard request: leave valuation, reliability, and collectibility as ''.";

export class IdentifyError extends Error {}

export async function identifyCar(
  mediaType: string,
  base64Data: string,
  premium: boolean,
  userText?: string,
): Promise<CarReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new IdentifyError(
      "Server has no ANTHROPIC_API_KEY set. Add it to .env.local and restart.",
    );
  }

  const textParts = [PROMPT_BASE + (premium ? PROMPT_PREMIUM : PROMPT_BASIC)];
  if (userText && userText.trim()) {
    textParts.push(`\nThe spotter added a note: "${userText.trim()}". Use it as a hint if helpful.`);
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      tools: [CAR_TOOL],
      tool_choice: { type: "tool", name: "report_car" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
            { type: "text", text: textParts.join("") },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new IdentifyError(`Anthropic API error ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  const block = (data.content || []).find(
    (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === "report_car",
  );
  if (!block) throw new IdentifyError("Model did not return a structured car report.");

  const input = block.input as Partial<CarReport>;
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
  };
}

// "My Garage" — a per-user history of every car they've identified.
// Backed by Upstash Redis (same DB as the feed/leaderboard/profiles).
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function garageConfigured(): boolean {
  return !!(REDIS_URL && REDIS_TOKEN);
}

async function cmd(args: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const r = await fetch(REDIS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()).result;
  } catch {
    return null;
  }
}

export type GarageCar = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  image: string; // small base64 thumbnail
  confidence: string;
  rarityScore: number;
  priceRange: string;
  ts: number;
};

const MAX = 200;

export async function addToGarage(
  email: string,
  input: {
    image?: string;
    make?: string;
    model?: string;
    yearRange?: string;
    confidence?: string;
    rarityScore?: number;
    priceRange?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!garageConfigured() || !email) return { ok: false, error: "garage not configured" };
  const image = input.image && input.image.length < 300_000 ? input.image : "";
  const car: GarageCar = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    make: input.make || "",
    model: input.model || "",
    yearRange: input.yearRange || "",
    image,
    confidence: input.confidence || "",
    rarityScore: typeof input.rarityScore === "number" ? input.rarityScore : 0,
    priceRange: input.priceRange || "",
    ts: Date.now(),
  };
  try {
    await cmd(["LPUSH", `garage:${email}`, JSON.stringify(car)]);
    await cmd(["LTRIM", `garage:${email}`, 0, MAX - 1]);
    return { ok: true };
  } catch {
    return { ok: false, error: "save failed" };
  }
}

export async function getGarage(email: string, limit = MAX): Promise<GarageCar[]> {
  if (!garageConfigured() || !email) return [];
  const raw = (await cmd(["LRANGE", `garage:${email}`, 0, limit - 1])) as string[] | null;
  if (!Array.isArray(raw)) return [];
  const out: GarageCar[] = [];
  for (const s of raw) {
    try {
      out.push(JSON.parse(s) as GarageCar);
    } catch {
      /* skip */
    }
  }
  return out;
}

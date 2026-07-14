import { put, list } from "@vercel/blob";

// Global "rarest cars spotted" leaderboard, shared across ALL accounts.
// Backed by a single JSON file in a Vercel Blob store (auto-provisioned).
// Read-modify-write; fine for this app's scale (best-effort under heavy concurrency).

export type RareCar = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  rarityScore: number;
  rarityReason?: string;
  priceRange?: string;
  image?: string; // small base64 thumbnail
  spotter: string; // display name, or "Anonymous"
  ts: number;
};

const PATH = "leaderboard.json";
const MAX = 50;

export function leaderboardConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH });
    const hit = blobs.find((b) => b.pathname === PATH) ?? blobs[0];
    return hit?.url ?? null;
  } catch {
    return null;
  }
}

export async function readBoard(): Promise<RareCar[]> {
  const url = await currentUrl();
  if (!url) return [];
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as RareCar[]) : [];
  } catch {
    return [];
  }
}

async function writeBoard(cars: RareCar[]): Promise<void> {
  await put(PATH, JSON.stringify(cars), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

// Insert a spotted car, dedupe by make+model keeping the rarest instance,
// and keep only the top MAX by rarity.
export async function recordRareSpot(car: Omit<RareCar, "id" | "ts">): Promise<void> {
  if (!leaderboardConfigured()) return;
  if (!car.make || !car.model || !(car.rarityScore > 0)) return;

  const board = await readBoard();
  const entry: RareCar = {
    ...car,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  };

  const byModel = new Map<string, RareCar>();
  for (const c of [entry, ...board].sort((a, b) => b.rarityScore - a.rarityScore)) {
    const key = `${c.make} ${c.model}`.toLowerCase().trim();
    if (!byModel.has(key)) byModel.set(key, c);
  }
  const top = [...byModel.values()].sort((a, b) => b.rarityScore - a.rarityScore).slice(0, MAX);
  await writeBoard(top);
}

import { put, list } from "@vercel/blob";
import { blobToken, blobConfigured } from "./blob-token";

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
  /**
   * The car's photo. A Blob URL on anything stored from now on; older entries
   * hold a base64 data URL instead. Both work in an <img src>, so nothing has
   * to migrate — the renderer cannot tell them apart.
   */
  image?: string;
  spotter: string; // @username, or "Anonymous"
  spotterImage?: string; // profile picture thumbnail, or "" for the animated default
  ts: number;
};

const PATH = "leaderboard.json";
const MAX = 50;
/** 2MB. A 1000px JPEG lands around 150KB, so this is slack, not a target. */
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export class LeaderboardError extends Error {}

/**
 * Store a car's photo as a file and return its URL.
 *
 * The photo used to live in the leaderboard JSON as base64. That document is
 * read and rewritten in full on every spot, so each entry's image was being
 * sent over the wire on every read and rewritten on every write — and at 50
 * entries a 1000px photo each would make it roughly 8MB. As files it stays a
 * few kilobytes of text, and the images are fetched independently and cached
 * by the browser like any other image.
 */
export async function uploadLeaderboardPhoto(dataUrl: string, id: string): Promise<string> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) throw new LeaderboardError("Photo must be a JPEG, PNG or WebP.");
  const [, contentType, b64] = m;
  const buf = Buffer.from(b64, "base64");
  if (buf.byteLength === 0) throw new LeaderboardError("That photo is empty.");
  if (buf.byteLength > MAX_PHOTO_BYTES) throw new LeaderboardError("That photo is too large.");
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  try {
    const { url } = await put(`leaderboard/${id}.${ext}`, buf, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: blobToken(),
    });
    return url;
  } catch (e) {
    throw new LeaderboardError("Couldn't store that photo.", { cause: e });
  }
}

export function leaderboardConfigured(): boolean {
  return blobConfigured();
}

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
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
    cacheControlMaxAge: 60,
    token: blobToken(),
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

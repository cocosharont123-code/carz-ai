import { put, list } from "@vercel/blob";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * Where and when cars were spotted.
 *
 * Only spots taken through the camera in the app are recorded. A photo chosen
 * from the library could have been taken anywhere by anyone at any time, and a
 * map of those is a map of nothing — the point of this one is that every pin is
 * somewhere a car actually was.
 *
 * Coordinates are rounded before they are stored, and it matters: this document
 * is served from a public URL like every other blob here, so anything in it is
 * readable by anyone who finds it. A pin is meant to say "a GT3 was seen around
 * here", not to publish the doorstep somebody was standing on. Three decimal
 * places is about 110 metres — enough to cluster a neighbourhood, not enough to
 * place a person.
 */

export type Spot = {
  id: string;
  /** Rounded. See the note above. */
  lat: number;
  lng: number;
  make: string;
  model: string;
  yearRange: string;
  /** What the spotter called it, when they named it. */
  carName?: string;
  rarityScore: number;
  /** @username, or "Anonymous". */
  spotter: string;
  at: number;
  /**
   * The scan both this pin and its leaderboard entry came from.
   *
   * The map and the board are separate stores written by two separate requests
   * after one identification, and nothing used to tie them together: the same
   * car was two unrelated rows. The scan mints one id and sends it to both, so a
   * pin can find its board entry and an entry can find its pin.
   *
   * Optional, and stays optional. Every spot recorded before this existed has
   * none, a scan that places a pin for an ordinary car never reaches the board
   * at all, and the board keeps only the highest-scoring car per model -- so a
   * key that matches nothing is the normal case, not a broken one.
   */
  scanId?: string;
};

const PATH = "spots.json";
/** Bounded: the document is rewritten whole on every write. */
const MAX = 500;
/** ~110m. */
const PRECISION = 3;

/**
 * How long a pin lasts.
 *
 * A day. The map answers "what is out there right now", and a sighting from
 * last month answers a different question badly — it says a car is somewhere it
 * has long since driven away from.
 *
 * Enforced on read as well as on write. Filtering only on write would leave a
 * pin visible for however long it happened to be until the next person spotted
 * something, which on a quiet day is indefinitely.
 */
export const SPOT_TTL_MS = 24 * 60 * 60 * 1000;

const isLive = (s: Spot, now = Date.now()) =>
  typeof s?.at === "number" && now - s.at < SPOT_TTL_MS;

export class SpotsError extends Error {}

export function spotsConfigured(): boolean {
  return blobConfigured();
}

/** Rounded to PRECISION, and rejected outright if it is not a real coordinate. */
export function coarse(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < -90 || a > 90 || b < -180 || b > 180) return null;
  // 0,0 is in the Gulf of Guinea and is what a broken geolocation reports.
  if (a === 0 && b === 0) return null;
  const f = 10 ** PRECISION;
  return { lat: Math.round(a * f) / f, lng: Math.round(b * f) / f };
}

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
    return (blobs.find((b) => b.pathname === PATH) ?? blobs[0])?.url ?? null;
  } catch (e) {
    throw new SpotsError("Couldn't list the spots blob.", { cause: e });
  }
}

/**
 * Throws rather than returning [] when the read fails: an empty list would read
 * as "nobody has spotted anything", and the next write would persist that and
 * erase the map.
 */
async function readAll(): Promise<Spot[]> {
  const url = await currentUrl();
  if (!url) return [];
  let res: Response;
  try {
    res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  } catch (e) {
    throw new SpotsError("Couldn't reach the spots blob.", { cause: e });
  }
  if (!res.ok) throw new SpotsError(`Spots read failed (HTTP ${res.status}).`);
  try {
    const data = await res.json();
    return Array.isArray(data) ? (data as Spot[]) : [];
  } catch (e) {
    throw new SpotsError("Spots blob is not valid JSON.", { cause: e });
  }
}

async function writeAll(spots: Spot[]): Promise<void> {
  try {
    await put(PATH, JSON.stringify(spots), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      token: blobToken(),
      cacheControlMaxAge: 60,
    });
  } catch (e) {
    throw new SpotsError("Couldn't write the spots blob.", { cause: e });
  }
}

/** Newest first, and nothing older than a day. */
export async function listSpots(): Promise<Spot[]> {
  if (!spotsConfigured()) return [];
  const all = await readAll().catch(() => [] as Spot[]);
  const now = Date.now();
  return all
    .filter((s) => isLive(s, now))
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX);
}

export async function recordSpot(input: {
  lat: number;
  lng: number;
  make: string;
  model: string;
  yearRange?: string;
  carName?: string;
  rarityScore?: number;
  spotter: string;
  scanId?: string;
}): Promise<Spot | null> {
  if (!spotsConfigured()) return null;
  const at = coarse(input.lat, input.lng);
  if (!at) return null;

  const spot: Spot = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    lat: at.lat,
    lng: at.lng,
    make: input.make.slice(0, 40),
    model: input.model.slice(0, 40),
    yearRange: (input.yearRange ?? "").slice(0, 24),
    ...(input.carName ? { carName: input.carName.slice(0, 60) } : {}),
    rarityScore: Math.max(0, Math.min(120, Math.round(input.rarityScore ?? 0))),
    spotter: input.spotter.slice(0, 40),
    at: Date.now(),
    ...(input.scanId ? { scanId: input.scanId.slice(0, 40) } : {}),
  };

  const all = await readAll();
  // Expired pins are dropped here rather than left to accumulate. Every write
  // rewrites the whole document anyway, so this is the free moment to do it and
  // the blob never grows past a day's worth of spotting.
  const now = Date.now();
  const kept = [...all.filter((s) => isLive(s, now)), spot]
    .sort((a, b) => a.at - b.at)
    .slice(-MAX);
  await writeAll(kept);
  return spot;
}

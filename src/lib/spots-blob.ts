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
};

const PATH = "spots.json";
/** Bounded: the document is rewritten whole on every write. */
const MAX = 500;
/** ~110m. */
const PRECISION = 3;

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

/** Newest first. */
export async function listSpots(): Promise<Spot[]> {
  if (!spotsConfigured()) return [];
  const all = await readAll().catch(() => [] as Spot[]);
  return [...all].sort((a, b) => b.at - a.at).slice(0, MAX);
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
  };

  const all = await readAll();
  all.push(spot);
  // Oldest go first once the cap is reached.
  const kept = all.sort((a, b) => a.at - b.at).slice(-MAX);
  await writeAll(kept);
  return spot;
}

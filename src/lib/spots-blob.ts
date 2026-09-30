import { put, list } from "@vercel/blob";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * Where and when cars were spotted.
 *
 * Only spots taken with the camera land here. A photo chosen from the library
 * could have been taken anywhere, years ago, by someone else — pinning it to
 * wherever the phone happens to be standing now would put a lie on the map.
 * That distinction is made at the point of capture and cannot be reconstructed
 * afterwards, which is why it is carried through as a flag rather than guessed
 * at here.
 *
 * Coordinates are rounded before they are stored. Three decimal places is about
 * 110 metres — enough to see that a car was found in South Beach, not enough to
 * say which driveway. Nobody needs a public map that resolves to a house, and
 * a spot is very often taken outside the spotter's own.
 */

export type Spot = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  lng: number;
  lat: number;
  /** When it was spotted, not when it was written. */
  at: number;
  /** @username, or "Anonymous" for a spotter who is not signed in. */
  spotter: string;
  rarityScore: number;
};

const PATH = "spots.json";
/** Bounded: this document is read and rewritten whole on every new spot. */
const MAX = 500;
/** Roughly 110 metres. Deliberately coarse — see the note above. */
const PLACES = 3;

export class SpotsError extends Error {}

export function spotsConfigured(): boolean {
  return blobConfigured();
}

const round = (n: number) => Math.round(n * 10 ** PLACES) / 10 ** PLACES;

export function validCoords(lng: unknown, lat: unknown): boolean {
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 85 &&
    // 0,0 is the Atlantic. It is what a broken geolocation reports, never a car.
    !(lng === 0 && lat === 0)
  );
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
 * Throws rather than returning [] when the read fails. An empty list would read
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
      cacheControlMaxAge: 30,
    });
  } catch (e) {
    throw new SpotsError("Couldn't write the spots blob.", { cause: e });
  }
}

/** Newest first. */
export async function listSpots(limit = MAX): Promise<Spot[]> {
  if (!spotsConfigured()) return [];
  const all = await readAll().catch(() => [] as Spot[]);
  return all.slice(0, Math.max(1, Math.min(MAX, limit)));
}

export async function recordSpot(input: {
  make: string;
  model: string;
  yearRange: string;
  lng: number;
  lat: number;
  spotter: string;
  rarityScore: number;
}): Promise<void> {
  if (!spotsConfigured()) return;
  if (!input.make || !input.model || !validCoords(input.lng, input.lat)) return;

  const all = await readAll();
  all.unshift({
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    make: input.make.slice(0, 40),
    model: input.model.slice(0, 40),
    yearRange: (input.yearRange || "").slice(0, 20),
    lng: round(input.lng),
    lat: round(input.lat),
    at: Date.now(),
    spotter: (input.spotter || "Anonymous").slice(0, 40),
    rarityScore: Math.max(0, Math.min(120, Math.round(input.rarityScore) || 0)),
  });
  await writeAll(all.slice(0, MAX));
}

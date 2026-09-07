import { put, list } from "@vercel/blob";
import { blobToken, blobConfigured } from "./blob-token";

// "Spotted near you" — cars other people caught on the live in-app camera in the
// last couple of hours, close to wherever you are now.
//
// Deliberately separate from the leaderboard: that board keeps the rarest cars
// forever and doesn't care where they were seen, while this one is the opposite —
// every car qualifies, but only for two hours and only near you. Sharing a store
// would mean one of the two rules always losing.

export type NearbySpot = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  image?: string; // small base64 thumbnail
  rarityScore: number;
  priceRange?: string;
  // Coarsened to ~1km before it is ever written — see coarsen().
  lat: number;
  lng: number;
  spotter: string; // @username, or "Anonymous"
  spotterImage?: string;
  ts: number;
};

const PATH = "nearby-spots.json";
const MAX = 300;

/** The whole feature: spots stop counting as "recent" after two hours. */
export const WINDOW_MS = 2 * 60 * 60 * 1000;

/** How far away still counts as "near you", in kilometres. */
export const RADIUS_KM = 40;

export function nearbyConfigured(): boolean {
  return blobConfigured();
}

/**
 * Round a coordinate to ~1.1km before storing it.
 *
 * These spots are readable by every other user, and a spot is usually where the
 * spotter is standing — often their own street. Two decimal places is precise
 * enough to answer "is this near me?" across a 40km radius and far too coarse to
 * place someone at an address.
 */
function coarsen(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Great-circle distance in kilometres. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la = (aLat * Math.PI) / 180;
  const lb = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
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

/** Everything still inside the two-hour window, newest first. */
export async function readRecent(): Promise<NearbySpot[]> {
  const url = await currentUrl();
  if (!url) return [];
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return fresh(data as NearbySpot[]);
  } catch {
    return [];
  }
}

// Expiry is enforced on read as well as write: nothing sweeps the store on a
// schedule, so a spot that aged out during a quiet spell would otherwise keep
// showing up until the next person spotted something.
function fresh(spots: NearbySpot[]): NearbySpot[] {
  const cutoff = Date.now() - WINDOW_MS;
  return spots.filter((s) => s && s.ts > cutoff).sort((a, b) => b.ts - a.ts);
}

async function write(spots: NearbySpot[]): Promise<void> {
  await put(PATH, JSON.stringify(spots), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    // Short cache: a two-hour feed that lags by a minute is fine, by ten is not.
    cacheControlMaxAge: 30,
    token: blobToken(),
  });
}

export async function recordLiveSpot(
  spot: Omit<NearbySpot, "id" | "ts" | "lat" | "lng"> & { lat: number; lng: number },
): Promise<void> {
  if (!nearbyConfigured()) return;
  if (!spot.make || !spot.model) return;
  if (!Number.isFinite(spot.lat) || !Number.isFinite(spot.lng)) return;

  const entry: NearbySpot = {
    ...spot,
    lat: coarsen(spot.lat),
    lng: coarsen(spot.lng),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  };

  const board = await readRecent();
  await write([entry, ...board].slice(0, MAX));
}

/** The recent spots within RADIUS_KM of a point, nearest-first, each with its distance. */
export function near(spots: NearbySpot[], lat: number, lng: number): (NearbySpot & { km: number })[] {
  return spots
    .map((s) => ({ ...s, km: distanceKm(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.km <= RADIUS_KM)
    .sort((a, b) => a.km - b.km);
}

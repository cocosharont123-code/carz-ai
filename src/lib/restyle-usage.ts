import { put, list } from "@vercel/blob";
import { createHash } from "crypto";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * Per-user daily quota for the AI car customizer, persisted in Vercel Blob so
 * it survives across serverless invocations. Keyed by a hash of the email so
 * raw emails never land in the blob. Best-effort under heavy concurrency.
 */

export const RESTYLE_DAILY_CAP = 3;

/** Price of one extra generation once the daily three are gone. */
export const RESTYLE_EXTRA_PRICE_USD = 0.5;

const PATH = "restyle-usage.json";

// `credits` are bought, so they deliberately do NOT reset with `day` — someone
// who pays at 11pm still has what they paid for the next morning.
type Usage = Record<string, { day: string; count: number; credits?: number }>;

export type RestyleQuota = {
  /** Free generations used today. */
  used: number;
  /** Free generations left today. */
  freeRemaining: number;
  /** Bought extras in hand. */
  credits: number;
  /** What can actually be spent right now. */
  available: number;
};

function keyFor(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 24);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
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

async function readAll(): Promise<Usage> {
  const url = await currentUrl();
  if (!url) return {};
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === "object" ? (data as Usage) : {};
  } catch {
    return {};
  }
}

async function writeAll(map: Usage): Promise<void> {
  await put(PATH, JSON.stringify(map), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
    token: blobToken(),
  });
}

function quotaFrom(entry: Usage[string] | undefined): RestyleQuota {
  const used = entry && entry.day === today() ? entry.count : 0;
  const credits = Math.max(0, entry?.credits ?? 0);
  const freeRemaining = Math.max(0, RESTYLE_DAILY_CAP - used);
  return { used, freeRemaining, credits, available: freeRemaining + credits };
}

/** Today's quota for a user. If storage isn't configured, reports the free allowance. */
export async function getRestyleUsage(email: string): Promise<RestyleQuota> {
  if (!blobConfigured()) return quotaFrom(undefined);
  const all = await readAll();
  return quotaFrom(all[keyFor(email)]);
}

/**
 * Record one successful generation.
 *
 * Spends the free daily allowance first and only then a bought credit, so
 * nobody burns something they paid for while a free one was still available.
 */
export async function recordRestyle(email: string): Promise<RestyleQuota> {
  if (!blobConfigured()) return { used: 1, freeRemaining: RESTYLE_DAILY_CAP - 1, credits: 0, available: RESTYLE_DAILY_CAP - 1 };
  const all = await readAll();
  const key = keyFor(email);
  const t = today();
  const cur = all[key];

  const usedToday = cur && cur.day === t ? cur.count : 0;
  let credits = Math.max(0, cur?.credits ?? 0);
  let count = usedToday;

  if (usedToday < RESTYLE_DAILY_CAP) count = usedToday + 1;
  else if (credits > 0) credits -= 1;
  // Neither available: the route refuses before reaching here, so this only
  // guards a race and records nothing rather than going negative.

  all[key] = { day: t, count, credits };
  await writeAll(all);
  return quotaFrom(all[key]);
}

/** Add bought generations. See the credits route for the payment caveat. */
export async function grantRestyleCredits(email: string, n = 1): Promise<RestyleQuota> {
  const add = Math.max(1, Math.min(10, Math.floor(n)));
  if (!blobConfigured()) {
    return { used: 0, freeRemaining: RESTYLE_DAILY_CAP, credits: add, available: RESTYLE_DAILY_CAP + add };
  }
  const all = await readAll();
  const key = keyFor(email);
  const cur = all[key];
  all[key] = {
    day: cur?.day ?? today(),
    count: cur?.count ?? 0,
    credits: Math.max(0, cur?.credits ?? 0) + add,
  };
  await writeAll(all);
  return quotaFrom(all[key]);
}

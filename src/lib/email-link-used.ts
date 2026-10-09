import { createHash } from "crypto";
import { put, list } from "@vercel/blob";
import { blobToken, blobConfigured } from "./blob-token";
import { LINK_TTL_MS } from "./email-link";

/**
 * The spent-link record.
 *
 * A signed token proves who asked for the link; it cannot know the link has
 * already been used. Without this, a link sitting in a forwarded mail or a
 * shared browser history is a working key for its whole lifetime, and "works
 * once" in the mail would be a lie.
 *
 * Only the jti is stored — never the address — because these blobs are served
 * from public URLs. Entries are dropped once they are older than a link can
 * live, so the file stays the size of fifteen minutes of sign-ins rather than
 * growing forever.
 *
 * Same best-effort caveat as ai-rate-limit.ts: read-modify-write on a JSON blob
 * has no compare-and-set, so two clicks landing inside one round trip could both
 * win. That is a far smaller window than the fifteen minutes it closes.
 */

const PATH = "email-links-used.json";

type Used = { jti: string; ts: number };

export function usedStoreConfigured(): boolean {
  return blobConfigured();
}

async function currentUrlFor(path: string): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: path, token: blobToken() });
    return (blobs.find((b) => b.pathname === path) ?? blobs[0])?.url ?? null;
  } catch {
    return null;
  }
}

async function readJson<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

async function read(): Promise<Used[]> {
  const url = await currentUrlFor(PATH);
  return url ? readJson<Used>(url) : [];
}

/**
 * Record a link as spent.
 *
 * Returns false when this jti was already there — the caller must refuse the
 * sign-in. Throws if the store cannot be written, because a replay check that
 * silently does nothing is worse than one that is absent: it reads as enforced.
 */
export async function claimLink(jti: string): Promise<boolean> {
  const cutoff = Date.now() - LINK_TTL_MS;
  const fresh = (await read()).filter((u) => u.ts > cutoff);
  if (fresh.some((u) => u.jti === jti)) return false;

  await put(PATH, JSON.stringify([{ jti, ts: Date.now() }, ...fresh]), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
    token: blobToken(),
  });
  return true;
}

/* --- issuance rate limit ------------------------------------------------- */

const RATE_PATH = "email-link-rate.json";

/** Per address, per window. Enough to survive a lost mail, not enough to flood one. */
const MAX_PER_WINDOW = 3;
const RATE_WINDOW_MS = 15 * 60 * 1000;

type Ask = { key: string; ts: number };

/** Hashed for the same reason ai-rate-limit.ts hashes: these blobs are public. */
function keyFor(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("base64url").slice(0, 22);
}

/**
 * Record a request for a link, and say whether to send one.
 *
 * The endpoint is open to anyone who can POST, so without this a stranger can
 * drop a sign-in mail into someone's inbox as often as they like — harassment,
 * and a way to burn the mail quota, neither needing an account.
 *
 * Fails open: if the store is unreachable the mail still goes. A limiter that
 * takes sign-in down during a bad Blob minute is worse than the abuse it stops.
 */
export async function takeLinkRequest(email: string): Promise<boolean> {
  if (!blobConfigured()) return true;
  const key = keyFor(email);
  const cutoff = Date.now() - RATE_WINDOW_MS;
  try {
    const url = await currentUrlFor(RATE_PATH);
    const fresh = (url ? await readJson<Ask>(url) : []).filter((a) => a.ts > cutoff);
    if (fresh.filter((a) => a.key === key).length >= MAX_PER_WINDOW) return false;

    await put(RATE_PATH, JSON.stringify([{ key, ts: Date.now() }, ...fresh].slice(0, 500)), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 0,
      token: blobToken(),
    });
    return true;
  } catch {
    return true;
  }
}

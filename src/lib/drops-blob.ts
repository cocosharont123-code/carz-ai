import { put, list } from "@vercel/blob";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * The New Drops list, cached in Blob storage.
 *
 * The route used to hold this in a module-level variable and nothing else, with
 * a six-hour TTL. On a serverless host that cache belongs to one warm instance,
 * so in practice most people opened the page on a cold one and waited out a
 * full model call -- ten to twenty seconds of generating a dozen cars that the
 * previous visitor had already generated -- before anything rendered.
 *
 * Blob is the app's only shared store, so it is where a list that moves on the
 * scale of weeks belongs. A read is one JSON GET; the model call becomes the
 * exception rather than the rule, and when the stored copy is stale it is still
 * served immediately and refreshed behind the response.
 */

const PATH = "drops-cache.json";

type Cached<T> = { at: number; drops: T[] };

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
    const hit = blobs.find((b) => b.pathname === PATH) ?? blobs[0];
    return hit?.url ?? null;
  } catch {
    return null;
  }
}

/** The stored list, or null when there is nothing usable. Never throws. */
export async function readDropsCache<T>(): Promise<Cached<T> | null> {
  if (!blobConfigured()) return null;
  const url = await currentUrl();
  if (!url) return null;
  try {
    // Cache-busted: the blob is written with a short max-age, and a stale CDN
    // copy here would mean serving a list that has already been refreshed.
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const at = typeof data?.at === "number" ? data.at : 0;
    const drops = Array.isArray(data?.drops) ? (data.drops as T[]) : [];
    return drops.length > 0 && at > 0 ? { at, drops } : null;
  } catch {
    return null;
  }
}

/** Best-effort: a storage failure must not fail a request that already has an answer. */
export async function writeDropsCache<T>(drops: T[]): Promise<void> {
  if (!blobConfigured() || drops.length === 0) return;
  try {
    await put(PATH, JSON.stringify({ at: Date.now(), drops } satisfies Cached<T>), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      token: blobToken(),
    });
  } catch {
    /* the list is already on its way to the client */
  }
}

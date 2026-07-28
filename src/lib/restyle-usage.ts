import { put, list } from "@vercel/blob";
import { createHash } from "crypto";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * Per-user daily quota for the AI car customizer, persisted in Vercel Blob so
 * it survives across serverless invocations. Keyed by a hash of the email so
 * raw emails never land in the blob. Best-effort under heavy concurrency.
 */

export const RESTYLE_DAILY_CAP = 3;

const PATH = "restyle-usage.json";
type Usage = Record<string, { day: string; count: number }>;

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

/** Today's usage for a user. If storage isn't configured, reports full quota. */
export async function getRestyleUsage(email: string): Promise<{ used: number; remaining: number }> {
  if (!blobConfigured()) return { used: 0, remaining: RESTYLE_DAILY_CAP };
  const all = await readAll();
  const cur = all[keyFor(email)];
  const used = cur && cur.day === today() ? cur.count : 0;
  return { used, remaining: Math.max(0, RESTYLE_DAILY_CAP - used) };
}

/** Record one successful generation. Returns the remaining quota after it. */
export async function recordRestyle(email: string): Promise<number> {
  if (!blobConfigured()) return RESTYLE_DAILY_CAP - 1;
  const all = await readAll();
  const key = keyFor(email);
  const t = today();
  const cur = all[key];
  const count = cur && cur.day === t ? cur.count + 1 : 1;
  all[key] = { day: t, count };
  await writeAll(all);
  return Math.max(0, RESTYLE_DAILY_CAP - count);
}

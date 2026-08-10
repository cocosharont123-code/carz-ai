import { put, list } from "@vercel/blob";
import { createHash, randomUUID } from "crypto";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * Carz+ car-configuration history. Every customizer render a member generates
 * is recorded here, so the list follows the account instead of the browser.
 * Keyed by a hash of the email so raw emails never land in the blob — same
 * shape as restyle-usage.ts.
 *
 * Configs only: the rendered photos stay on-device (see builds-local.ts). A
 * shared JSON blob is the wrong place for base64 images, and the config is what
 * has to survive a device change.
 *
 * Like restyle-usage.ts, this is a read-modify-write over one shared document,
 * so it's best-effort under heavy concurrency: two writes landing in the same
 * instant can cost one entry. Acceptable for a history; move to a real DB
 * before anything depends on it being exact.
 */

export type ConfigEntry = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  bodyColor?: string;
  bodyHex?: string;
  rimColor?: string;
  rimHex?: string;
  features: string[];
  ts: number;
};

const PATH = "config-history.json";
const MAX_PER_USER = 100;

type History = Record<string, ConfigEntry[]>;

function keyFor(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 24);
}

/**
 * Storage that's reachable but failing (a suspended store answers `list` and
 * then 403s every read) must not look like an empty history — that renders as
 * "no builds yet" and quietly loses the member's data. Only a store with no
 * document yet is genuinely empty; everything else throws.
 */
async function readAll(): Promise<History> {
  const { blobs } = await list({ prefix: PATH, token: blobToken() });
  const hit = blobs.find((b) => b.pathname === PATH) ?? blobs[0];
  if (!hit?.url) return {}; // nothing written yet — legitimately empty

  const res = await fetch(`${hit.url}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`config history unreadable (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data && typeof data === "object" ? (data as History) : {};
}

async function writeAll(map: History): Promise<void> {
  await put(PATH, JSON.stringify(map), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
    token: blobToken(),
  });
}

/** A member's configs, newest first. Empty when storage isn't configured. */
export async function getConfigHistory(email: string): Promise<ConfigEntry[]> {
  if (!blobConfigured()) return [];
  const all = await readAll();
  return all[keyFor(email)] ?? [];
}

/**
 * Record one generated config. Returns the stored entry (the client pairs its
 * local render thumbnail with `id`), or null if storage isn't configured.
 */
export async function recordConfig(
  email: string,
  config: Omit<ConfigEntry, "id" | "ts">,
): Promise<ConfigEntry | null> {
  if (!blobConfigured()) return null;
  const all = await readAll();
  const key = keyFor(email);
  const entry: ConfigEntry = { ...config, id: randomUUID(), ts: Date.now() };
  all[key] = [entry, ...(all[key] ?? [])].slice(0, MAX_PER_USER);
  await writeAll(all);
  return entry;
}

export async function deleteConfig(email: string, id: string): Promise<ConfigEntry[]> {
  if (!blobConfigured()) return [];
  const all = await readAll();
  const key = keyFor(email);
  const next = (all[key] ?? []).filter((e) => e.id !== id);
  all[key] = next;
  await writeAll(all);
  return next;
}

export async function clearConfigHistory(email: string): Promise<void> {
  if (!blobConfigured()) return;
  const all = await readAll();
  delete all[keyFor(email)];
  await writeAll(all);
}

export function configHistoryConfigured(): boolean {
  return blobConfigured();
}

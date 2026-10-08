import { createHash } from "crypto";
import { put, list } from "@vercel/blob";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * A rate limit for the AI endpoints that survives a cold start.
 *
 * The scan cap was counted in lib/store.ts, which is an in-memory object backed
 * by a JSON file under /tmp. On Vercel that is per serverless instance and
 * per-instance means per cold start: a new container is a fresh counter, so the
 * cap was not so much leaky as absent. It was also keyed on UID_COOKIE, which
 * anyone can clear.
 *
 * This is keyed on the signed-in email and stored in Blob, which is the same
 * thing restyle-usage.ts already does for the customizer -- a working pattern
 * already in this codebase rather than a new dependency and a new environment
 * variable to provision.
 *
 * Emails are hashed before they are written. These blobs are served from public
 * URLs, so anything in one is readable by whoever finds it, and a file of
 * addresses next to a count of what each person did is not a file to publish.
 *
 * Two limits, because they stop different things. The daily cap is the bill. The
 * burst cap is a script: a cap of eight a day still allows eight expensive
 * vision calls fired in the same second, and the thing that runs a bill up is
 * not a person pressing a button.
 *
 * Best effort under concurrency. Read-modify-write on a JSON blob has no
 * compare-and-set, so two requests landing together can both read the same count
 * and both be allowed. The overshoot is bounded by how many can arrive inside one
 * read-write round trip -- a handful, not a multiple -- and the alternative is
 * Redis, a dependency, and an env var. Worth revisiting if the bill ever says it
 * matters.
 */

const PATH = "ai-usage.json";

/** Rolling window for the burst cap. */
const BURST_WINDOW_MS = 60_000;

/** How many calls that window allows, per endpoint. */
export const BURST_LIMIT: Record<string, number> = {
  identify: 4,
  carzbot: 10,
};

type Entry = {
  /** UTC day, so the reset is not a per-timezone argument. */
  day: string;
  count: number;
  /** Timestamps inside the burst window, newest last. */
  recent: number[];
};

type Usage = Record<string, Entry>;

export type Decision =
  | { ok: true; usedToday: number; remaining: number | null }
  | { ok: false; reason: "daily" | "burst"; usedToday: number; retryAfter: number };

const today = () => new Date().toISOString().slice(0, 10);

/** Per endpoint and per person, hashed. */
function keyFor(endpoint: string, email: string): string {
  const who = createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 24);
  return `${endpoint}:${who}`;
}

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
    return (blobs.find((b) => b.pathname === PATH) ?? blobs[0])?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns {} when the read fails rather than throwing.
 *
 * Deliberately the opposite of the spots and leaderboard stores, which throw so
 * a failed read cannot be persisted as "empty" and erase real data. Nothing here
 * is data anyone would miss, and the consequence of guessing wrong runs the other
 * way: throwing would mean a storage blip takes scanning down for everybody,
 * where returning {} means a few calls slip through.
 */
async function read(): Promise<Usage> {
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

async function write(usage: Usage): Promise<void> {
  try {
    await put(PATH, JSON.stringify(usage), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      token: blobToken(),
      cacheControlMaxAge: 0,
    });
  } catch {
    // A failed write means this call is not counted. Better than refusing a scan
    // somebody is entitled to because storage hiccuped.
  }
}

/**
 * Prunes entries nobody is using any more.
 *
 * The document is rewritten whole on every call, so without this it grows by one
 * key per account forever and every scan pays to download all of it.
 */
function prune(usage: Usage, day: string): Usage {
  const out: Usage = {};
  for (const [k, v] of Object.entries(usage)) {
    if (v?.day === day) out[k] = v;
  }
  return out;
}

/**
 * Checks and records in one pass.
 *
 * One read and one write rather than a check call and a record call, because two
 * round trips doubles both the latency and the window in which two requests can
 * race each other.
 *
 * `dailyCap` of null means no daily cap -- the MAX tier. The burst cap still
 * applies: unlimited is a promise about a day, not permission to run a loop.
 */
export async function takeAiCall(
  endpoint: keyof typeof BURST_LIMIT | string,
  email: string,
  dailyCap: number | null,
): Promise<Decision> {
  // No storage configured: allow, rather than locking everyone out of the
  // product because a token is missing.
  if (!blobConfigured()) return { ok: true, usedToday: 0, remaining: dailyCap };

  const day = today();
  const key = keyFor(endpoint, email);
  const now = Date.now();
  const burst = BURST_LIMIT[endpoint] ?? 10;

  const usage = prune(await read(), day);
  const cur = usage[key];
  const count = cur?.day === day ? cur.count : 0;
  const recent = (cur?.recent ?? []).filter((t) => now - t < BURST_WINDOW_MS);

  if (dailyCap !== null && count >= dailyCap) {
    // Until midnight UTC, in seconds, so a client can say when rather than
    // "later".
    const midnight = Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate() + 1,
    );
    return {
      ok: false,
      reason: "daily",
      usedToday: count,
      retryAfter: Math.max(1, Math.ceil((midnight - now) / 1000)),
    };
  }

  if (recent.length >= burst) {
    const oldest = recent[0];
    return {
      ok: false,
      reason: "burst",
      usedToday: count,
      retryAfter: Math.max(1, Math.ceil((BURST_WINDOW_MS - (now - oldest)) / 1000)),
    };
  }

  usage[key] = { day, count: count + 1, recent: [...recent, now] };
  await write(usage);

  return {
    ok: true,
    usedToday: count + 1,
    remaining: dailyCap === null ? null : Math.max(0, dailyCap - (count + 1)),
  };
}

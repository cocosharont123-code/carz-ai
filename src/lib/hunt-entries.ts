import { put, list } from "@vercel/blob";
import { createHash } from "crypto";
import { blobToken, blobConfigured } from "./blob-token";
import { HUNT_MIN_ENTRANTS } from "./hunt";

/**
 * Who has entered the hunt, so the board can say how many have and whether it
 * has started.
 *
 * One JSON document of hashed email -> the moment they entered. Hashed for the
 * same reason profiles are: a raw email has no business in a public blob. The
 * timestamps are not read anywhere yet; they are kept because a count you can
 * only ever read as a single number tells you nothing later about when people
 * arrived.
 */

const PATH = "hunt/entries.json";

export class HuntEntriesError extends Error {}

export type HuntStatus = {
  configured: boolean;
  /** How many distinct accounts have entered. */
  count: number;
  /** How many are needed before it starts. */
  goal: number;
  /** Whether the caller is one of them. */
  entered: boolean;
  /** Whether the hunt is running. */
  started: boolean;
};

export function huntEntriesConfigured(): boolean {
  return blobConfigured();
}

function keyFor(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 24);
}

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
    const hit = blobs.find((b) => b.pathname === PATH) ?? blobs[0];
    return hit?.url ?? null;
  } catch (e) {
    throw new HuntEntriesError("Couldn't list the hunt entries blob.", { cause: e });
  }
}

/**
 * Throws rather than returning {} when the store can't be read. An empty map
 * would read as "nobody has entered", and the next write would persist that —
 * erasing every entrant.
 */
async function readAll(): Promise<Record<string, number>> {
  const url = await currentUrl();
  if (!url) return {}; // genuinely nobody yet
  let res: Response;
  try {
    res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  } catch (e) {
    throw new HuntEntriesError("Couldn't reach the hunt entries blob.", { cause: e });
  }
  if (!res.ok) {
    throw new HuntEntriesError(`Hunt entries read failed (HTTP ${res.status}).`);
  }
  try {
    const data = await res.json();
    return data && typeof data === "object" ? (data as Record<string, number>) : {};
  } catch (e) {
    throw new HuntEntriesError("Hunt entries blob is not valid JSON.", { cause: e });
  }
}

async function writeAll(map: Record<string, number>): Promise<void> {
  try {
    await put(PATH, JSON.stringify(map), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      token: blobToken(),
      cacheControlMaxAge: 60,
    });
  } catch (e) {
    throw new HuntEntriesError("Couldn't write the hunt entries blob.", { cause: e });
  }
}

function statusFrom(map: Record<string, number>, email?: string): HuntStatus {
  const count = Object.keys(map).length;
  return {
    configured: true,
    count,
    goal: HUNT_MIN_ENTRANTS,
    entered: !!email && map[keyFor(email)] !== undefined,
    started: count >= HUNT_MIN_ENTRANTS,
  };
}

export async function huntStatus(email?: string): Promise<HuntStatus> {
  if (!huntEntriesConfigured()) {
    return { configured: false, count: 0, goal: HUNT_MIN_ENTRANTS, entered: false, started: false };
  }
  return statusFrom(await readAll(), email);
}

/** Idempotent: entering twice is entering once, and never moves the count. */
export async function enterHunt(email: string): Promise<HuntStatus> {
  const map = await readAll();
  const key = keyFor(email);
  if (map[key] === undefined) {
    map[key] = Date.now();
    await writeAll(map);
  }
  return statusFrom(map, email);
}

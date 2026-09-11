import { put, list } from "@vercel/blob";
import { createHash } from "crypto";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * Who follows whom.
 *
 * One JSON document: the hash of a follower's email -> the usernames they
 * follow. Hashed for the same reason profiles are — a raw email has no
 * business in a public blob.
 *
 * Stored by follower rather than by followed, because "am I following this
 * channel" is the question asked on every channel view and it answers in one
 * lookup. Counting a channel's followers walks the map instead; at this size
 * that is cheaper than keeping two indexes that can disagree with each other.
 */

const PATH = "feed/follows.json";

export class FollowsError extends Error {}

/** followerHash -> usernames, lowercased. */
type FollowMap = Record<string, string[]>;

export function followsConfigured(): boolean {
  return blobConfigured();
}

export function followerKey(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 24);
}

const norm = (username: string) => username.replace(/^@/, "").toLowerCase().trim();

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
    const hit = blobs.find((b) => b.pathname === PATH) ?? blobs[0];
    return hit?.url ?? null;
  } catch (e) {
    throw new FollowsError("Couldn't list the follows blob.", { cause: e });
  }
}

/**
 * Throws rather than returning {} when the store can't be read — an empty map
 * would read as "nobody follows anybody", and the next write would persist that
 * and erase every follow in the app.
 */
async function readAll(): Promise<FollowMap> {
  const url = await currentUrl();
  if (!url) return {};
  let res: Response;
  try {
    res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  } catch (e) {
    throw new FollowsError("Couldn't reach the follows blob.", { cause: e });
  }
  if (!res.ok) throw new FollowsError(`Follows read failed (HTTP ${res.status}).`);
  try {
    const data = await res.json();
    return data && typeof data === "object" ? (data as FollowMap) : {};
  } catch (e) {
    throw new FollowsError("Follows blob is not valid JSON.", { cause: e });
  }
}

async function writeAll(map: FollowMap): Promise<void> {
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
    throw new FollowsError("Couldn't write the follows blob.", { cause: e });
  }
}

export type FollowStats = {
  followers: number;
  following: number;
  /** Whether the viewer follows this channel. False when signed out. */
  youFollow: boolean;
};

/** Counts for one channel, plus the viewer's relationship to it. */
export async function followStats(username: string, viewerEmail?: string): Promise<FollowStats> {
  if (!followsConfigured()) return { followers: 0, following: 0, youFollow: false };
  const map = await readAll();
  const target = norm(username);

  let followers = 0;
  for (const list of Object.values(map)) {
    if (list.includes(target)) followers++;
  }

  const viewerKey = viewerEmail ? followerKey(viewerEmail) : null;
  const mine = viewerKey ? (map[viewerKey] ?? []) : [];

  return {
    followers,
    // "Following" on a channel means how many that channel follows, which is
    // only knowable for the viewer's own channel — the map is keyed by a hash
    // nobody can reverse. Zero for anyone else, rather than a wrong number.
    following: viewerKey && mine.length ? mine.length : 0,
    youFollow: mine.includes(target),
  };
}

/** Idempotent both ways: following twice is following once. */
export async function setFollow(
  email: string,
  username: string,
  on: boolean,
): Promise<FollowStats> {
  const map = await readAll();
  const key = followerKey(email);
  const target = norm(username);
  const mine = new Set(map[key] ?? []);

  if (on) mine.add(target);
  else mine.delete(target);

  map[key] = [...mine];
  await writeAll(map);

  let followers = 0;
  for (const list of Object.values(map)) {
    if (list.includes(target)) followers++;
  }
  return { followers, following: mine.size, youFollow: on };
}

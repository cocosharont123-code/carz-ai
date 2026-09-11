import { put, list } from "@vercel/blob";
import { createHash } from "crypto";
import { blobToken, blobConfigured } from "./blob-token";
import { safeImageDataUrl } from "./safe-media";

// User profiles (username + display name + picture), stored in Vercel Blob.
// Keyed by a hash of the email so raw emails never land in the public blob.

export type Profile = {
  username: string;
  displayName: string;
  image: string; // base64 thumbnail, or "" for the animated default
  /**
   * Birthday as "MM-DD" — month and day, never a year.
   *
   * Stored without one on purpose: a birth year is the piece that makes a
   * birthday useful for identifying someone, and nothing here needs it. There
   * is no field to put one in, so none can be collected by accident.
   */
  birthday?: string;
  /** Channel bio — a couple of lines under the name. */
  bio?: string;
  /** Channel cover image: a base64 thumbnail, or "" for the gradient. */
  cover?: string;
  ts: number;
  member?: boolean; // any paid membership
  /**
   * Which one. Absent on records written before MAX existed, and those are
   * Carz+ — the tier they were actually sold.
   */
  tier?: MemberTier;
  memberSince?: number;
  billing?: "monthly" | "annual"; // paid billing interval (unset ≈ monthly)
  trialEndsAt?: number; // set while on a free trial; membership lapses once passed
  trialUsed?: boolean; // a free trial has been started before (one per account)
  streak?: number; // consecutive days active (members)
  streakDay?: string; // YYYY-MM-DD of last streak increment
};

// Length of the Carz+ free trial.
export const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 86_400_000;

// A profile counts as an active member if the flag is on and, when on a trial,
// the trial hasn't lapsed. Paid membership has no trialEndsAt, so never expires.
export type MemberTier = "plus" | "max";

/**
 * Which membership is active, or null.
 *
 * A record from before MAX existed has no tier and is Carz+: that is what those
 * people paid for, and defaulting them upward would hand out the higher tier to
 * everyone who ever subscribed.
 */
export function memberTier(p: Profile | null | undefined): MemberTier | null {
  if (!isActiveMember(p)) return null;
  return p?.tier === "max" ? "max" : "plus";
}

/** MAX only — the tier that includes it. */
export function isMaxMember(p: Profile | null | undefined): boolean {
  return memberTier(p) === "max";
}

export function isActiveMember(p: Profile | null | undefined): boolean {
  if (!p?.member) return false;
  if (p.trialEndsAt && Date.now() >= p.trialEndsAt) return false;
  return true;
}

const PATH = "profiles.json";

// Strongly-consistent mirror of the stored username, so the profile gate accepts
// a rename before the Blob write propagates. Shared so account deletion clears
// the same cookie the profile route sets, rather than leaving a stale name behind.
export const UNAME_COOKIE = "cs_uname";

// Storage is down/unreachable (suspended store, network, bad token). Distinct
// from "no profiles yet" so writes can refuse to run on top of a failed read.
export class ProfileStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProfileStorageError";
  }
}

export function profilesConfigured(): boolean {
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
    throw new ProfileStorageError("Couldn't list the profiles blob.", { cause: e });
  }
}

// Throws ProfileStorageError if the store can't be read. Returning {} on a
// failed read would make every profile look missing — and `writeAll` would then
// persist that empty map, wiping everyone else's account.
async function readAll(): Promise<Record<string, Profile>> {
  const url = await currentUrl();
  if (!url) return {}; // genuinely no profiles written yet
  let res: Response;
  try {
    res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  } catch (e) {
    throw new ProfileStorageError("Couldn't reach the profiles blob.", { cause: e });
  }
  if (!res.ok) {
    throw new ProfileStorageError(`Profiles blob read failed (HTTP ${res.status}).`);
  }
  try {
    const data = await res.json();
    return data && typeof data === "object" ? (data as Record<string, Profile>) : {};
  } catch (e) {
    throw new ProfileStorageError("Profiles blob is not valid JSON.", { cause: e });
  }
}

async function writeAll(map: Record<string, Profile>): Promise<void> {
  try {
    await put(PATH, JSON.stringify(map), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      token: blobToken(),
      // Vercel Blob rejects a value below 60s. Reads already cache-bust with a
      // `?t=` query + `no-store`, so the CDN TTL doesn't affect freshness.
      cacheControlMaxAge: 60,
    });
  } catch (e) {
    throw new ProfileStorageError("Couldn't write the profiles blob.", { cause: e });
  }
}

export function validateUsername(raw: string): { ok: boolean; error?: string; value: string } {
  const value = (raw || "").trim().toLowerCase();
  if (value.length < 3) return { ok: false, error: "Username must be at least 3 characters.", value };
  if (value.length > 20) return { ok: false, error: "Username must be 20 characters or fewer.", value };
  if (!/^[a-z0-9_]+$/.test(value))
    return { ok: false, error: "Use only letters, numbers and underscores.", value };
  return { ok: true, value };
}

// --- Auto-generated names ---------------------------------------------------
// Nobody is asked to invent a username. Everyone gets one on first sight, and
// can rename later on /profile if they care.

// Whole words, <=6 chars each, so `adjective_noun9999` fits validateUsername's
// 20-char limit and the display name never reads as a truncation.
const ADJECTIVES = [
  "swift", "turbo", "chrome", "nitro", "vivid", "amber", "cosmic", "drift",
  "sleek", "atomic", "vapor", "lunar", "solar", "rapid", "onyx", "volt",
];
const NOUNS = [
  "falcon", "piston", "coupe", "bolt", "rotor", "cobra", "spyder", "apex",
  "camber", "diesel", "clutch", "fender", "grille", "hubcap", "torque", "wagon",
];

// Deterministic in `email`: the same person gets the same name every time, even
// when storage is unreachable and nothing can be written down. A random name
// would otherwise change on every request during an outage.
export function generatedNameFor(email: string): { username: string; displayName: string } {
  const h = createHash("sha256").update(`name:${email.toLowerCase().trim()}`).digest();
  const adj = ADJECTIVES[h[0] % ADJECTIVES.length];
  const noun = NOUNS[h[1] % NOUNS.length];
  // 4 digits keeps the namespace at ~2.5M, so collisions stay rare enough that
  // `freeUsername`'s numeric suffix is a genuine edge case rather than routine.
  const num = (((h[2] << 16) | (h[3] << 8) | h[4]) >>> 0) % 10_000;
  return {
    username: `${adj}_${noun}${num}`,
    displayName: `${adj[0].toUpperCase()}${adj.slice(1)} ${noun[0].toUpperCase()}${noun.slice(1)}`,
  };
}

function generatedProfile(email: string): Profile {
  const { username, displayName } = generatedNameFor(email);
  return { username, displayName, image: "", ts: 0 };
}

// Append digits until the name is free, keeping inside the 20-char limit.
function freeUsername(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const suffix = String(n);
    const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base.slice(0, 16) + Math.floor(Date.now() % 10_000);
}

// The record for this account inside an already-loaded map, generating one if
// the account has never been seen. Mutates `all`; the caller still writes it.
function recordIn(all: Record<string, Profile>, email: string): Profile {
  const key = keyFor(email);
  const existing = all[key];
  if (existing?.username) return existing;

  const fallback = generatedProfile(email);
  const taken = new Set<string>();
  for (const [k, p] of Object.entries(all)) {
    if (k !== key && p.username) taken.add(p.username.toLowerCase());
  }
  const created: Profile = {
    ...existing, // keep membership/streak if a record exists without a username
    ...fallback,
    username: freeUsername(fallback.username, taken),
    ts: Date.now(),
  };
  all[key] = created;
  return created;
}

// The profile for this account, creating one with a generated name if there
// isn't one yet. Never throws and never returns null: if storage is missing or
// down we still hand back the generated identity (`stored: false`) so signing
// in works and the rest of the app has a name to show. The write is retried
// naturally on the next request.
export async function ensureProfile(
  email: string,
): Promise<{ profile: Profile; stored: boolean }> {
  const fallback = generatedProfile(email);
  if (!profilesConfigured()) return { profile: fallback, stored: false };

  let all: Record<string, Profile>;
  try {
    all = await readAll();
  } catch {
    return { profile: fallback, stored: false };
  }

  const existing = all[keyFor(email)];
  if (existing?.username) return { profile: existing, stored: true };

  const profile = recordIn(all, email);
  try {
    await writeAll(all);
  } catch {
    return { profile, stored: false };
  }
  return { profile, stored: true };
}

// `strict` surfaces a storage outage instead of reporting "no profile" — used by
// the profile endpoint so the setup gate doesn't trap users while the store is down.
export async function getProfile(
  email: string,
  opts: { strict?: boolean } = {},
): Promise<Profile | null> {
  try {
    const all = await readAll();
    return all[keyFor(email)] ?? null;
  } catch (e) {
    if (opts.strict) throw e;
    return null;
  }
}

/** "MM-DD" and a real day of that month. Rejects anything with a year in it. */
export function validateBirthday(raw: string): { ok: boolean; value?: string } {
  const v = (raw || "").trim();
  if (!v) return { ok: true, value: "" }; // clearing it is allowed
  const m = /^(\d{2})-(\d{2})$/.exec(v);
  if (!m) return { ok: false };
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1) return { ok: false };
  // Leap day is allowed: 29 February is a birthday even in years it isn't a date.
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > maxDay) return { ok: false };
  return { ok: true, value: `${m[1]}-${m[2]}` };
}

export async function setProfile(
  email: string,
  data: {
    username: string;
    displayName?: string;
    image?: string;
    birthday?: string;
    bio?: string;
    cover?: string;
  },
): Promise<{ ok: boolean; error?: string; profile?: Profile }> {
  const v = validateUsername(data.username);
  if (!v.ok) return { ok: false, error: v.error };

  const all = await readAll();
  const myKey = keyFor(email);

  // Enforce unique usernames (case-insensitive), ignoring my own record.
  for (const [k, p] of Object.entries(all)) {
    if (k !== myKey && p.username.toLowerCase() === v.value) {
      return { ok: false, error: "That username is taken." };
    }
  }

  // Raster image data URLs only. The previous check accepted anything starting
  // "data:", which included text/html and SVG — values that are documents, not
  // pictures, stored in a shared blob and served to every other user.
  const image =
    data.image === undefined
      ? (all[myKey]?.image ?? "")
      : safeImageDataUrl(data.image, 80_000);

  // Undefined means "not being edited" and keeps what is stored; an empty
  // string is an explicit clear.
  let birthday = all[myKey]?.birthday ?? "";
  if (data.birthday !== undefined) {
    const b = validateBirthday(data.birthday);
    if (!b.ok) return { ok: false, error: "That birthday isn't a real date." };
    birthday = b.value ?? "";
  }

  // Undefined leaves what is stored; an empty string is an explicit clear.
  const bio =
    data.bio === undefined ? (all[myKey]?.bio ?? "") : data.bio.trim().slice(0, 200);
  const cover =
    data.cover === undefined
      ? (all[myKey]?.cover ?? "")
      : safeImageDataUrl(data.cover, 120_000);

  const profile: Profile = {
    ...all[myKey], // preserve membership + streak
    username: v.value,
    bio,
    cover,
    displayName: (data.displayName || "").trim().slice(0, 40) || v.value,
    image,
    birthday,
    ts: Date.now(),
  };
  all[myKey] = profile;
  await writeAll(all);
  return { ok: true, profile };
}

/**
 * Erase this account's profile record — username, picture, membership, streak.
 *
 * Reads the whole map first and refuses to write on a failed read, same as
 * every other mutation here: persisting a partial map would delete everyone.
 * Returns false when there was nothing stored under this email to begin with,
 * so the caller can tell "removed" from "never existed" without a second read.
 */
export async function deleteProfile(email: string): Promise<boolean> {
  const all = await readAll();
  const myKey = keyFor(email);
  if (!all[myKey]) return false;
  delete all[myKey];
  await writeAll(all);
  return true;
}

// --- Carz+ membership + streaks ---

export async function setMembership(
  email: string,
  on: boolean,
  interval?: "monthly" | "annual",
  tier: MemberTier = "plus",
): Promise<Profile | null> {
  const all = await readAll();
  const key = keyFor(email);
  const p = recordIn(all, email); // joining never waits on manual setup
  p.member = on;
  if (on) {
    p.tier = tier;
    if (!p.memberSince) p.memberSince = Date.now();
    if (interval) p.billing = interval;
    delete p.trialEndsAt; // paid membership never expires
  }
  all[key] = p;
  await writeAll(all);
  return p;
}

// Usernames (lowercased) of everyone currently holding active Carz+ membership.
// Used to badge spotters on the shared leaderboard.
/**
 * A profile by its public username, case-insensitively.
 *
 * Usernames are unique (setProfile enforces it), so this is a lookup rather
 * than a search. Returns null when nobody holds the name — a channel URL is
 * user input and "no such channel" is a normal answer, not an error.
 */
export async function findByUsername(username: string): Promise<Profile | null> {
  if (!profilesConfigured()) return null;
  const want = username.replace(/^@/, "").toLowerCase().trim();
  if (!want) return null;
  const all = await readAll();
  return Object.values(all).find((p) => p.username.toLowerCase() === want) ?? null;
}

export type ProfileCard = {
  username: string;
  displayName: string;
  image: string;
  bio: string;
  member: boolean;
};

/**
 * Accounts matching a query, best match first.
 *
 * Substring rather than prefix: people search for the middle of a handle as
 * often as the start. Exact matches lead, then handles that begin with the
 * query, then everything else — so typing someone's full username puts them
 * first rather than ninth.
 */
export async function searchProfiles(query: string, limit = 20): Promise<ProfileCard[]> {
  if (!profilesConfigured()) return [];
  const q = query.replace(/^@/, "").toLowerCase().trim();
  if (!q) return [];

  const score = (p: Profile): number => {
    const u = p.username.toLowerCase();
    const d = (p.displayName || "").toLowerCase();
    if (u === q) return 0;
    if (u.startsWith(q)) return 1;
    if (d.startsWith(q)) return 2;
    if (u.includes(q)) return 3;
    if (d.includes(q)) return 4;
    return 99;
  };

  return Object.values(await readAll())
    .map((p) => ({ p, s: score(p) }))
    .filter((x) => x.s < 99)
    .sort((a, b) => a.s - b.s || a.p.username.localeCompare(b.p.username))
    .slice(0, limit)
    .map(({ p }) => ({
      username: p.username,
      displayName: p.displayName || p.username,
      image: p.image || "",
      bio: p.bio || "",
      member: isActiveMember(p),
    }));
}

export async function memberUsernames(): Promise<Set<string>> {
  const all = await readAll();
  const set = new Set<string>();
  for (const p of Object.values(all)) {
    if (p.username && isActiveMember(p)) set.add(p.username.toLowerCase());
  }
  return set;
}

// Start the one-time 7-day free trial. Grants membership until trialEndsAt.
export async function startTrial(
  email: string,
): Promise<{ ok: boolean; error?: string; profile?: Profile }> {
  const all = await readAll();
  const key = keyFor(email);
  const p = recordIn(all, email); // starting a trial never waits on manual setup
  if (isActiveMember(p)) return { ok: false, error: "You're already a Carz+ member." };
  if (p.trialUsed) return { ok: false, error: "You've already used your free trial." };
  p.member = true;
  p.trialUsed = true;
  p.trialEndsAt = Date.now() + TRIAL_MS;
  if (!p.memberSince) p.memberSince = Date.now();
  all[key] = p;
  await writeAll(all);
  return { ok: true, profile: p };
}

function dayStr(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toISOString().slice(0, 10);
}

// Increment the member's day-streak once per day.
export async function touchStreak(email: string): Promise<Profile | null> {
  const all = await readAll();
  const key = keyFor(email);
  const p = all[key];
  if (!p || !isActiveMember(p)) return p ?? null;
  const today = dayStr();
  if (p.streakDay === today) return p;
  p.streak = p.streakDay === dayStr(86_400_000) ? (p.streak ?? 0) + 1 : 1;
  p.streakDay = today;
  all[key] = p;
  await writeAll(all);
  return p;
}

// Restore a lost streak (paid $0.99 — payment handled elsewhere).
export async function restoreStreak(email: string, toValue: number): Promise<Profile | null> {
  const all = await readAll();
  const key = keyFor(email);
  const p = all[key];
  if (!p) return null;
  p.streak = Math.max(p.streak ?? 0, Math.max(0, Math.round(toValue)));
  p.streakDay = dayStr();
  all[key] = p;
  await writeAll(all);
  return p;
}

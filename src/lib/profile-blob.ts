import { put, list } from "@vercel/blob";
import { createHash } from "crypto";

// User profiles (username + display name + picture), stored in Vercel Blob.
// Keyed by a hash of the email so raw emails never land in the public blob.

export type Profile = {
  username: string;
  displayName: string;
  image: string; // base64 thumbnail, or "" for the animated default
  ts: number;
  member?: boolean; // Carz+ membership
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
export function isActiveMember(p: Profile | null | undefined): boolean {
  if (!p?.member) return false;
  if (p.trialEndsAt && Date.now() >= p.trialEndsAt) return false;
  return true;
}

const PATH = "profiles.json";

export function profilesConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function keyFor(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 24);
}

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH });
    const hit = blobs.find((b) => b.pathname === PATH) ?? blobs[0];
    return hit?.url ?? null;
  } catch {
    return null;
  }
}

async function readAll(): Promise<Record<string, Profile>> {
  const url = await currentUrl();
  if (!url) return {};
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === "object" ? (data as Record<string, Profile>) : {};
  } catch {
    return {};
  }
}

async function writeAll(map: Record<string, Profile>): Promise<void> {
  await put(PATH, JSON.stringify(map), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    // Vercel Blob rejects a value below 60s. Reads already cache-bust with a
    // `?t=` query + `no-store`, so the CDN TTL doesn't affect freshness.
    cacheControlMaxAge: 60,
  });
}

export function validateUsername(raw: string): { ok: boolean; error?: string; value: string } {
  const value = (raw || "").trim().toLowerCase();
  if (value.length < 3) return { ok: false, error: "Username must be at least 3 characters.", value };
  if (value.length > 20) return { ok: false, error: "Username must be 20 characters or fewer.", value };
  if (!/^[a-z0-9_]+$/.test(value))
    return { ok: false, error: "Use only letters, numbers and underscores.", value };
  return { ok: true, value };
}

export async function getProfile(email: string): Promise<Profile | null> {
  const all = await readAll();
  return all[keyFor(email)] ?? null;
}

export async function setProfile(
  email: string,
  data: { username: string; displayName?: string; image?: string },
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

  const image =
    typeof data.image === "string" && data.image.startsWith("data:") ? data.image.slice(0, 80_000) : all[myKey]?.image ?? "";

  const profile: Profile = {
    ...all[myKey], // preserve membership + streak
    username: v.value,
    displayName: (data.displayName || "").trim().slice(0, 40) || v.value,
    image,
    ts: Date.now(),
  };
  all[myKey] = profile;
  await writeAll(all);
  return { ok: true, profile };
}

// --- Carz+ membership + streaks ---

export async function setMembership(
  email: string,
  on: boolean,
  interval?: "monthly" | "annual",
): Promise<Profile | null> {
  const all = await readAll();
  const key = keyFor(email);
  const p = all[key];
  if (!p) return null; // must have a profile (username) first
  p.member = on;
  if (on) {
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
  const p = all[key];
  if (!p) return { ok: false, error: "Set a username first." };
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

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
  streak?: number; // consecutive days active (members)
  streakDay?: string; // YYYY-MM-DD of last streak increment
};

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

export async function setMembership(email: string, on: boolean): Promise<Profile | null> {
  const all = await readAll();
  const key = keyFor(email);
  const p = all[key];
  if (!p) return null; // must have a profile (username) first
  p.member = on;
  if (on && !p.memberSince) p.memberSince = Date.now();
  all[key] = p;
  await writeAll(all);
  return p;
}

function dayStr(offsetMs = 0): string {
  return new Date(Date.now() - offsetMs).toISOString().slice(0, 10);
}

// Increment the member's day-streak once per day.
export async function touchStreak(email: string): Promise<Profile | null> {
  const all = await readAll();
  const key = keyFor(email);
  const p = all[key];
  if (!p || !p.member) return p ?? null;
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

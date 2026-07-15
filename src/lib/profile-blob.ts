import { put, list } from "@vercel/blob";
import { createHash } from "crypto";

// User profiles (username + display name + picture), stored in Vercel Blob.
// Keyed by a hash of the email so raw emails never land in the public blob.

export type Profile = {
  username: string;
  displayName: string;
  image: string; // base64 thumbnail, or "" for the animated default
  ts: number;
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
    cacheControlMaxAge: 0,
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
    username: v.value,
    displayName: (data.displayName || "").trim().slice(0, 40) || v.value,
    image,
    ts: Date.now(),
  };
  all[myKey] = profile;
  await writeAll(all);
  return { ok: true, profile };
}

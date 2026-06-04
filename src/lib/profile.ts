// User profiles (username + display name) backed by Upstash Redis.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function profileConfigured(): boolean {
  return !!(REDIS_URL && REDIS_TOKEN);
}

async function cmd(args: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const r = await fetch(REDIS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()).result;
  } catch {
    return null;
  }
}

export type Profile = { username: string; displayName: string; image: string };

export function validateUsername(u: string): string | null {
  if (!/^[a-z0-9_]{3,20}$/.test(u)) {
    return "Username must be 3–20 characters: lowercase letters, numbers, or underscores.";
  }
  return null;
}

export async function getProfile(email: string): Promise<Profile | null> {
  if (!profileConfigured() || !email) return null;
  const raw = (await cmd(["GET", `profile:${email}`])) as string | null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

export async function setProfile(
  email: string,
  input: { username: string; displayName?: string; image?: string },
): Promise<{ ok: boolean; error?: string; profile?: Profile }> {
  if (!profileConfigured()) return { ok: false, error: "Profiles aren't enabled yet." };
  const username = (input.username || "").toLowerCase().trim();
  const vErr = validateUsername(username);
  if (vErr) return { ok: false, error: vErr };
  const displayName = (input.displayName || "").trim().slice(0, 40) || username;

  const existing = await getProfile(email);
  const owner = (await cmd(["GET", `handle:${username}`])) as string | null;
  if (owner && owner !== email) return { ok: false, error: "That username is already taken." };

  if (existing?.username && existing.username !== username) {
    await cmd(["DEL", `handle:${existing.username}`]);
  }
  const profile: Profile = { username, displayName, image: input.image || existing?.image || "" };
  await cmd(["SET", `profile:${email}`, JSON.stringify(profile)]);
  await cmd(["SET", `handle:${username}`, email]);
  return { ok: true, profile };
}

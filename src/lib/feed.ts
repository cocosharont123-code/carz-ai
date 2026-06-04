// Social feed backed by Upstash Redis (same DB as the leaderboard).
// Posts store a small JPEG thumbnail inline (base64) to avoid needing separate
// blob storage — fine for an MVP. Move images to Vercel Blob to scale.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function feedConfigured(): boolean {
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

export type FeedPost = {
  id: string;
  userName: string;
  userImage: string;
  image: string; // base64 data URL thumbnail
  make: string;
  model: string;
  yearRange: string;
  caption: string;
  ts: number;
  likes: number;
};

const TIMELINE = "feed:timeline";

export async function createPost(
  user: { name?: string | null; image?: string | null },
  data: { image: string; make: string; model: string; yearRange: string; caption: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!feedConfigured()) return { ok: false, error: "feed not configured" };
  if (!data.image?.startsWith("data:image")) return { ok: false, error: "missing image" };
  if (data.image.length > 400_000) return { ok: false, error: "image too large" };

  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const post: FeedPost = {
    id,
    userName: user.name || "Spotter",
    userImage: user.image || "",
    image: data.image,
    make: data.make || "",
    model: data.model || "",
    yearRange: data.yearRange || "",
    caption: (data.caption || "").slice(0, 280),
    ts: Date.now(),
    likes: 0,
  };
  try {
    await cmd(["SET", `post:${id}`, JSON.stringify(post)]);
    await cmd(["ZADD", TIMELINE, post.ts, id]);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "save failed" };
  }
}

export async function listPosts(limit = 30): Promise<FeedPost[]> {
  if (!feedConfigured()) return [];
  const ids = (await cmd(["ZREVRANGE", TIMELINE, 0, limit - 1])) as string[] | null;
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const out: FeedPost[] = [];
  for (const id of ids) {
    const raw = (await cmd(["GET", `post:${id}`])) as string | null;
    if (!raw) continue;
    try {
      const p = JSON.parse(raw) as FeedPost;
      const likes = (await cmd(["GET", `post:${id}:likes`])) as string | null;
      p.likes = likes ? Number(likes) : 0;
      out.push(p);
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function likePost(id: string): Promise<number> {
  if (!feedConfigured()) return 0;
  const n = await cmd(["INCR", `post:${id}:likes`]);
  return Number(n) || 0;
}

import { put, list, del } from "@vercel/blob";
import { createHash, randomUUID } from "crypto";
import { blobToken, blobConfigured } from "./blob-token";

// The car-enthusiast feed: photo posts with captions, likes and comments.
//
// Stored in Vercel Blob as one JSON document, the same shape the auctions and
// profiles stores use. Emails are hashed and never written, so the raw blob
// carries no identity — display names come from the profile store instead.
//
// Photos are *not* inlined as base64 the way auction thumbnails are. This
// document is rewritten on every like and every comment, and a feed of inlined
// photos would mean rewriting megabytes to register a tap. Each photo is its
// own blob and the post keeps only its URL.

export type FeedLike = {
  userHash: string;
  ts: number;
};

export type FeedComment = {
  id: string;
  userHash: string;
  userName: string;
  text: string;
  ts: number;
};

/**
 * A video post's edit, stored as playback instructions rather than baked into
 * the file. Nothing is re-encoded: the player seeks to `trimStartMs`, stops at
 * `trimEndMs`, mutes the original track if asked, and runs the music underneath.
 *
 * The trade is deliberate — no ffmpeg, no 30MB WASM download, and it works on
 * mobile Safari. The cost is that the edit only exists inside Carz: download the
 * file and you get the untrimmed original with no music.
 */
export type FeedEdit = {
  trimStartMs: number;
  trimEndMs: number; // 0 = play to the end
  muteOriginal: boolean;
  musicUrl: string; // "" = no music
  musicTitle: string;
  musicVolume: number; // 0..1
  musicStartMs: number; // offset into the track
};

export const DEFAULT_EDIT: FeedEdit = {
  trimStartMs: 0,
  trimEndMs: 0,
  muteOriginal: false,
  musicUrl: "",
  musicTitle: "",
  musicVolume: 0.8,
  musicStartMs: 0,
};

export type FeedPost = {
  id: string;
  authorHash: string;
  authorName: string;
  authorImage: string; // base64 avatar thumbnail, or "" for the animated default
  /** Absent on records written before video existed — treat as "photo". */
  mediaKind?: "photo" | "video";
  imageUrl: string; // photo, or the video's poster frame
  videoUrl?: string;
  durationMs?: number;
  edit?: FeedEdit;
  caption: string;
  createdAt: number;
  likes: FeedLike[];
  comments: FeedComment[];
};

// What clients see: no hashes, counts instead of raw arrays, and the viewer's
// own relationship to the post resolved server-side.
export type PublicComment = {
  id: string;
  userName: string;
  text: string;
  ts: number;
  youWrote: boolean;
};

export type PublicPost = {
  id: string;
  authorName: string;
  authorImage: string;
  mediaKind: "photo" | "video";
  imageUrl: string;
  videoUrl: string;
  durationMs: number;
  edit: FeedEdit;
  caption: string;
  createdAt: number;
  likeCount: number;
  commentCount: number;
  likedByYou: boolean;
  youAreAuthor: boolean;
  comments?: PublicComment[]; // detail view only
};

export const CAPTION_MAX = 300;
export const COMMENT_MAX = 500;
/** Posts one account may create per UTC day. Stops the endpoint being spammed. */
export const DAILY_POST_LIMIT = 10;
export const PAGE_SIZE = 12;
/** Decoded photo ceiling. The client downscales well below this. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const PATH = "feed.json";

// Storage is down/unreachable, as distinct from "no posts yet". Writes refuse to
// run on top of a failed read: persisting an empty array over a real feed would
// delete everyone's posts.
export class FeedStorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "FeedStorageError";
  }
}

export function feedConfigured(): boolean {
  return blobConfigured();
}

// Local rather than shared with the auctions store: identity here only has to be
// stable within this file, and importing it would tie the feed to a feature it
// has nothing to do with.
export function hashEmail(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex").slice(0, 24);
}

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
    const hit = blobs.find((b) => b.pathname === PATH) ?? blobs[0];
    return hit?.url ?? null;
  } catch (e) {
    throw new FeedStorageError("Couldn't list the feed blob.", { cause: e });
  }
}

async function readAll(): Promise<FeedPost[]> {
  const url = await currentUrl();
  if (!url) return []; // genuinely nothing posted yet
  let res: Response;
  try {
    res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
  } catch (e) {
    throw new FeedStorageError("Couldn't reach the feed blob.", { cause: e });
  }
  if (!res.ok) throw new FeedStorageError(`Feed blob read failed (HTTP ${res.status}).`);
  try {
    const data = await res.json();
    return Array.isArray(data) ? (data as FeedPost[]) : [];
  } catch (e) {
    throw new FeedStorageError("Feed blob is not valid JSON.", { cause: e });
  }
}

async function writeAll(posts: FeedPost[]): Promise<void> {
  try {
    await put(PATH, JSON.stringify(posts), {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
      addRandomSuffix: false,
      token: blobToken(),
      // Blob rejects anything under 60s. Reads cache-bust with `?t=`, so this
      // doesn't affect freshness.
      cacheControlMaxAge: 60,
    });
  } catch (e) {
    throw new FeedStorageError("Couldn't write the feed blob.", { cause: e });
  }
}

/** Normalise records written before a field existed. */
function hydrate(p: FeedPost): FeedPost {
  p.likes = Array.isArray(p.likes) ? p.likes : [];
  p.comments = Array.isArray(p.comments) ? p.comments : [];
  return p;
}

export function toPublicPost(
  p: FeedPost,
  viewerHash: string | null,
  opts: { withComments?: boolean } = {},
): PublicPost {
  hydrate(p);
  const out: PublicPost = {
    id: p.id,
    authorName: p.authorName,
    authorImage: p.authorImage ?? "",
    mediaKind: p.mediaKind === "video" ? "video" : "photo",
    imageUrl: p.imageUrl,
    videoUrl: p.videoUrl ?? "",
    durationMs: p.durationMs ?? 0,
    edit: { ...DEFAULT_EDIT, ...(p.edit ?? {}) },
    caption: p.caption,
    createdAt: p.createdAt,
    likeCount: p.likes.length,
    commentCount: p.comments.length,
    likedByYou: !!viewerHash && p.likes.some((l) => l.userHash === viewerHash),
    youAreAuthor: !!viewerHash && p.authorHash === viewerHash,
  };
  if (opts.withComments) {
    out.comments = p.comments
      .slice()
      .sort((a, b) => a.ts - b.ts) // flat and chronological, oldest first
      .map((c) => ({
        id: c.id,
        userName: c.userName,
        text: c.text,
        ts: c.ts,
        youWrote: !!viewerHash && c.userHash === viewerHash,
      }));
  }
  return out;
}

/**
 * One page of the feed, newest first. Offset-based: posts are stored newest
 * first and only ever prepended, so an offset stays meaningful between calls.
 */
export async function listPosts(
  viewerHash: string | null,
  opts: { offset?: number; limit?: number } = {},
): Promise<{ posts: PublicPost[]; total: number; nextOffset: number | null }> {
  const all = await readAll();
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  const limit = Math.min(PAGE_SIZE, Math.max(1, Math.floor(opts.limit ?? PAGE_SIZE)));
  const slice = all.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  return {
    posts: slice.map((p) => toPublicPost(p, viewerHash)),
    total: all.length,
    nextOffset: nextOffset < all.length ? nextOffset : null,
  };
}

export async function getPost(id: string): Promise<FeedPost | null> {
  const all = await readAll();
  const hit = all.find((p) => p.id === id);
  return hit ? hydrate(hit) : null;
}

/** Posts this account has made since 00:00 UTC — the rate-limit counter. */
export async function postsToday(authorHash: string): Promise<number> {
  const all = await readAll();
  const since = new Date().setUTCHours(0, 0, 0, 0);
  return all.filter((p) => p.authorHash === authorHash && p.createdAt >= since).length;
}

/**
 * Store the photo as its own blob and return its URL. Accepts the data URL the
 * client produces from a canvas downscale.
 */
export async function uploadFeedImage(dataUrl: string, postId: string): Promise<string> {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!m) throw new FeedStorageError("Photo must be a JPEG, PNG or WebP.");
  const [, contentType, b64] = m;
  const buf = Buffer.from(b64, "base64");
  if (buf.byteLength === 0) throw new FeedStorageError("That photo is empty.");
  if (buf.byteLength > MAX_IMAGE_BYTES) throw new FeedStorageError("That photo is too large.");
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  try {
    const { url } = await put(`feed/${postId}.${ext}`, buf, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: blobToken(),
    });
    return url;
  } catch (e) {
    throw new FeedStorageError("Couldn't store that photo.", { cause: e });
  }
}

/** A post id, minted before the photo is uploaded so both share it. */
export function newPostId(): string {
  return randomUUID().slice(0, 12);
}

/**
 * Videos and custom audio are uploaded straight from the browser to Blob, so
 * the URL reaches us from the client. Anything not served by our own Blob store
 * is refused — otherwise a post could point the player at an arbitrary host.
 */
export function isOurBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Clamp a client-supplied edit into something the player can trust. */
export function sanitizeEdit(raw: unknown, durationMs: number): FeedEdit {
  const e = (raw ?? {}) as Partial<FeedEdit>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

  const cap = durationMs > 0 ? durationMs : Number.MAX_SAFE_INTEGER;
  const start = Math.max(0, Math.min(cap, num(e.trimStartMs, 0)));
  let end = Math.max(0, Math.min(cap, num(e.trimEndMs, 0)));
  // An end at or before the start would freeze the player on one frame.
  if (end !== 0 && end <= start) end = 0;

  // Music has to be ours, or a path to a track bundled in /public.
  const musicUrl = typeof e.musicUrl === "string" ? e.musicUrl : "";
  const safeMusic = musicUrl.startsWith("/") || isOurBlobUrl(musicUrl) ? musicUrl : "";

  return {
    trimStartMs: start,
    trimEndMs: end,
    muteOriginal: !!e.muteOriginal,
    musicUrl: safeMusic,
    musicTitle: safeMusic ? String(e.musicTitle ?? "").slice(0, 80) : "",
    musicVolume: Math.max(0, Math.min(1, num(e.musicVolume, 0.8))),
    musicStartMs: Math.max(0, num(e.musicStartMs, 0)),
  };
}

export async function createPost(input: {
  id: string;
  authorEmail: string;
  authorName: string;
  authorImage: string;
  mediaKind: "photo" | "video";
  imageUrl: string;
  videoUrl?: string;
  durationMs?: number;
  edit?: FeedEdit;
  caption: string;
}): Promise<FeedPost> {
  const post: FeedPost = {
    id: input.id,
    authorHash: hashEmail(input.authorEmail),
    authorName: input.authorName || "Spotter",
    authorImage: input.authorImage || "",
    mediaKind: input.mediaKind,
    imageUrl: input.imageUrl,
    ...(input.mediaKind === "video"
      ? {
          videoUrl: input.videoUrl,
          durationMs: input.durationMs ?? 0,
          edit: input.edit ?? DEFAULT_EDIT,
        }
      : {}),
    caption: input.caption.trim().slice(0, CAPTION_MAX),
    createdAt: Date.now(),
    likes: [],
    comments: [],
  };
  const all = await readAll();
  all.unshift(post); // newest first, so the feed reads straight off the array
  await writeAll(all);
  return post;
}

export async function deletePost(
  id: string,
  viewerHash: string,
): Promise<{ ok: boolean; error?: string }> {
  const all = await readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: "Post not found." };
  if (all[idx].authorHash !== viewerHash) {
    return { ok: false, error: "You can only delete your own posts." };
  }
  const [removed] = all.splice(idx, 1);
  await writeAll(all);
  // The record is what makes the post exist; the media is now unreachable
  // either way, so a failure to clean it up must not fail the deletion.
  // Bundled /public tracks are skipped — they aren't ours to delete.
  const orphans = [removed.imageUrl, removed.videoUrl, removed.edit?.musicUrl].filter(
    (u): u is string => !!u && isOurBlobUrl(u),
  );
  for (const url of orphans) {
    try {
      await del(url, { token: blobToken() });
    } catch {
      /* orphaned blob — the post is gone, which is what was asked for */
    }
  }
  return { ok: true };
}

/** Toggle this viewer's like. One per user per post, enforced by the hash. */
export async function toggleLike(
  id: string,
  viewerHash: string,
): Promise<{ ok: boolean; error?: string; liked?: boolean; likeCount?: number }> {
  const all = await readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: "Post not found." };
  const post = hydrate(all[idx]);

  const at = post.likes.findIndex((l) => l.userHash === viewerHash);
  if (at >= 0) post.likes.splice(at, 1);
  else post.likes.push({ userHash: viewerHash, ts: Date.now() });

  all[idx] = post;
  await writeAll(all);
  return { ok: true, liked: at < 0, likeCount: post.likes.length };
}

export async function addComment(
  id: string,
  author: { hash: string; name: string },
  text: string,
): Promise<{ ok: boolean; error?: string; comment?: FeedComment }> {
  const body = (text || "").trim();
  if (!body) return { ok: false, error: "Write something first." };

  const all = await readAll();
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: "Post not found." };
  const post = hydrate(all[idx]);

  const comment: FeedComment = {
    id: randomUUID().slice(0, 12),
    userHash: author.hash,
    userName: author.name || "Spotter",
    text: body.slice(0, COMMENT_MAX),
    ts: Date.now(),
  };
  post.comments.push(comment);
  all[idx] = post;
  await writeAll(all);
  return { ok: true, comment };
}

export async function deleteComment(
  postId: string,
  commentId: string,
  viewerHash: string,
): Promise<{ ok: boolean; error?: string }> {
  const all = await readAll();
  const idx = all.findIndex((p) => p.id === postId);
  if (idx < 0) return { ok: false, error: "Post not found." };
  const post = hydrate(all[idx]);

  const at = post.comments.findIndex((c) => c.id === commentId);
  if (at < 0) return { ok: false, error: "Comment not found." };
  // The post's author can clear comments off their own photo; everyone else
  // may only remove what they wrote.
  const own = post.comments[at].userHash === viewerHash;
  if (!own && post.authorHash !== viewerHash) {
    return { ok: false, error: "You can only delete your own comments." };
  }

  post.comments.splice(at, 1);
  all[idx] = post;
  await writeAll(all);
  return { ok: true };
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/profile-blob";
import {
  listPosts,
  createPost,
  newPostId,
  uploadFeedImage,
  postsToday,
  hashEmail,
  feedConfigured,
  toPublicPost,
  FeedStorageError,
  CAPTION_MAX,
  DAILY_POST_LIMIT,
  PAGE_SIZE,
} from "@/lib/feed-blob";

export const runtime = "nodejs";

function storageFailure(e: unknown) {
  console.error("feed storage error:", e);
  const down = e instanceof FeedStorageError;
  const detail = e instanceof Error ? e.message : String(e);
  return NextResponse.json(
    {
      ok: false,
      unavailable: down,
      error: down ? `The feed is unavailable: ${detail}` : `Something went wrong: ${detail}`,
    },
    { status: down ? 503 : 500 },
  );
}

// GET /api/feed/posts?offset=0 -> one page, newest first.
export async function GET(req: Request) {
  if (!feedConfigured()) {
    return NextResponse.json({ configured: false, posts: [], total: 0, nextOffset: null });
  }
  const session = await auth();
  const viewerHash = session?.user?.email ? hashEmail(session.user.email) : null;

  const offset = Number(new URL(req.url).searchParams.get("offset")) || 0;
  try {
    const page = await listPosts(viewerHash, { offset, limit: PAGE_SIZE });
    return NextResponse.json({ configured: true, ...page });
  } catch (e) {
    return storageFailure(e);
  }
}

// POST /api/feed/posts -> create a post. Signed in only, rate limited.
export async function POST(req: Request) {
  if (!feedConfigured()) {
    return NextResponse.json({ ok: false, error: "The feed is not configured." }, { status: 503 });
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in to post." }, { status: 401 });
  }

  let body: { image?: string; caption?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const caption = (body.caption || "").trim();
  if (!body.image) {
    return NextResponse.json({ ok: false, error: "Add a photo." }, { status: 400 });
  }
  // Checked here as well as in the composer: the client is bypassable, and the
  // cap is what keeps a caption from becoming an essay in the blob.
  if (caption.length > CAPTION_MAX) {
    return NextResponse.json(
      { ok: false, error: `Captions are ${CAPTION_MAX} characters or fewer.` },
      { status: 400 },
    );
  }

  const { profile } = await ensureProfile(email);
  const authorHash = hashEmail(email);

  try {
    const used = await postsToday(authorHash);
    if (used >= DAILY_POST_LIMIT) {
      return NextResponse.json(
        {
          ok: false,
          error: `You've posted ${DAILY_POST_LIMIT} times today — that's the daily limit.`,
          rateLimited: true,
        },
        { status: 429 },
      );
    }

    // The photo is uploaded under the id the post will carry, so a failure here
    // leaves an orphaned blob rather than a post pointing at nothing.
    const id = newPostId();
    const imageUrl = await uploadFeedImage(body.image, id);
    const post = await createPost({
      id,
      authorEmail: email,
      authorName: `@${profile.username}`,
      authorImage: profile.image || "",
      imageUrl,
      caption,
    });

    return NextResponse.json({ ok: true, post: toPublicPost(post, authorHash) });
  } catch (e) {
    return storageFailure(e);
  }
}

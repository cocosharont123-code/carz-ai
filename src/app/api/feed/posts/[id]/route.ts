import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getPost,
  deletePost,
  toPublicPost,
  hashEmail,
  feedConfigured,
  FeedStorageError,
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

// GET /api/feed/posts/[id] -> one post, with its comments.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!feedConfigured()) {
    return NextResponse.json({ configured: false, post: null });
  }
  const { id } = await params;
  const session = await auth();
  const viewerHash = session?.user?.email ? hashEmail(session.user.email) : null;

  try {
    const post = await getPost(id);
    if (!post) {
      return NextResponse.json({ configured: true, post: null }, { status: 404 });
    }
    return NextResponse.json({
      configured: true,
      post: toPublicPost(post, viewerHash, { withComments: true }),
    });
  } catch (e) {
    return storageFailure(e);
  }
}

// DELETE /api/feed/posts/[id] -> remove your own post.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!feedConfigured()) {
    return NextResponse.json({ ok: false, error: "The feed is not configured." }, { status: 503 });
  }
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  try {
    // Ownership is checked inside the store, against the record rather than
    // anything the client sent.
    const res = await deletePost(id, hashEmail(email));
    if (!res.ok) {
      const notFound = res.error === "Post not found.";
      return NextResponse.json({ ok: false, error: res.error }, { status: notFound ? 404 : 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return storageFailure(e);
  }
}

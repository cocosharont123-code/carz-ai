import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleCommentLike, hashEmail, feedConfigured, FeedStorageError } from "@/lib/feed-blob";

export const runtime = "nodejs";

// POST /api/feed/posts/[id]/comments/[commentId]/like -> toggle. Same contract
// as the post-level like: keyed by the viewer's hash, so a double tap can't
// count twice, and the response carries the settled state rather than a delta.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  if (!feedConfigured()) {
    return NextResponse.json({ ok: false, error: "The feed is not configured." }, { status: 503 });
  }
  const { id, commentId } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in to like comments." }, { status: 401 });
  }

  try {
    const res = await toggleCommentLike(id, commentId, hashEmail(email));
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true, liked: res.liked, likeCount: res.likeCount });
  } catch (e) {
    console.error("feed storage error:", e);
    const down = e instanceof FeedStorageError;
    return NextResponse.json(
      { ok: false, error: down ? "The feed is unavailable." : "Couldn't register that." },
      { status: down ? 503 : 500 },
    );
  }
}

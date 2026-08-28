import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteComment, hashEmail, feedConfigured, FeedStorageError } from "@/lib/feed-blob";

export const runtime = "nodejs";

// DELETE /api/feed/posts/[id]/comments/[commentId] -> remove your own comment.
export async function DELETE(
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
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  try {
    // Authorship is resolved from the stored record, never from the request.
    const res = await deleteComment(id, commentId, hashEmail(email));
    if (!res.ok) {
      const missing = res.error?.endsWith("not found.");
      return NextResponse.json({ ok: false, error: res.error }, { status: missing ? 404 : 403 });
    }
    // `removed` lists the comment and any replies that went with it, so the
    // client drops the whole thread in one pass instead of the parent alone.
    return NextResponse.json({ ok: true, removed: res.removed ?? [commentId] });
  } catch (e) {
    console.error("feed storage error:", e);
    const down = e instanceof FeedStorageError;
    return NextResponse.json(
      { ok: false, error: down ? "The feed is unavailable." : "Couldn't delete that comment." },
      { status: down ? 503 : 500 },
    );
  }
}

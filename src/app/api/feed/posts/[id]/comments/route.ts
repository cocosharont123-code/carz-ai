import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/profile-blob";
import {
  addComment,
  toPublicComment,
  hashEmail,
  feedConfigured,
  FeedStorageError,
  COMMENT_MAX,
} from "@/lib/feed-blob";

export const runtime = "nodejs";

// POST /api/feed/posts/[id]/comments -> add a comment, or a reply when the
// body carries `parentId`.
// Reading comments happens through GET /api/feed/posts/[id], which already
// returns them, so there's no GET here to keep the two in sync.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!feedConfigured()) {
    return NextResponse.json({ ok: false, error: "The feed is not configured." }, { status: 503 });
  }
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in to comment." }, { status: 401 });
  }

  let body: { text?: string; parentId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "Write something first." }, { status: 400 });
  }
  if (text.length > COMMENT_MAX) {
    return NextResponse.json(
      { ok: false, error: `Comments are ${COMMENT_MAX} characters or fewer.` },
      { status: 400 },
    );
  }

  try {
    const viewerHash = hashEmail(email);
    const { profile } = await ensureProfile(email);
    const res = await addComment(
      id,
      { hash: viewerHash, name: `@${profile.username}` },
      text,
      // The store resolves this against the stored thread — a reply to a reply
      // is re-pointed at its parent rather than rejected.
      typeof body.parentId === "string" ? body.parentId : undefined,
    );
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true, comment: toPublicComment(res.comment!, viewerHash) });
  } catch (e) {
    console.error("feed storage error:", e);
    const down = e instanceof FeedStorageError;
    return NextResponse.json(
      { ok: false, error: down ? "The feed is unavailable." : "Couldn't post that comment." },
      { status: down ? 503 : 500 },
    );
  }
}

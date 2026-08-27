import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleLike, hashEmail, feedConfigured, FeedStorageError } from "@/lib/feed-blob";

export const runtime = "nodejs";

// POST /api/feed/posts/[id]/like -> toggle. Idempotent per user: the store keys
// likes by the viewer's hash, so a double tap can't count twice.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!feedConfigured()) {
    return NextResponse.json({ ok: false, error: "The feed is not configured." }, { status: 503 });
  }
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in to like posts." }, { status: 401 });
  }

  try {
    const res = await toggleLike(id, hashEmail(email));
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

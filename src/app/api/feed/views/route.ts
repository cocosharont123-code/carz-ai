import { NextResponse } from "next/server";
import { addViews, feedConfigured, FeedStorageError } from "@/lib/feed-blob";

export const runtime = "nodejs";

/**
 * Record plays, in batches.
 *
 * No sign-in: a view is a view whoever watched it. No per-account record
 * either, so this cannot be used to work out who watched what — the only thing
 * kept is a number on the post.
 *
 * Trivially inflatable by anyone willing to call it in a loop, which is true of
 * every unauthenticated counter. It is capped per call so a single request
 * cannot add thousands, and it is a vanity number rather than something the app
 * makes decisions on.
 */
export async function POST(req: Request) {
  if (!feedConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

  let body: { views?: Record<string, number> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const raw = body.views;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ ok: false, error: "Nothing to count." }, { status: 400 });
  }

  const counts: Record<string, number> = {};
  for (const [id, n] of Object.entries(raw).slice(0, 40)) {
    if (typeof id !== "string" || id.length > 64) continue;
    const v = Math.floor(Number(n));
    if (Number.isFinite(v) && v > 0) counts[id] = Math.min(v, 5);
  }

  try {
    await addViews(counts);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // A lost view is not worth telling anyone about.
    console.error("view count failed:", e);
    const down = e instanceof FeedStorageError;
    return NextResponse.json({ ok: false }, { status: down ? 503 : 500 });
  }
}

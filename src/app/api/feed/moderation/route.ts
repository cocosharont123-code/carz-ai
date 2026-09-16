import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getViewerState,
  setBlocked,
  setSaved,
  addReport,
  isReportReason,
  moderationConfigured,
  ModerationError,
} from "@/lib/moderation-blob";

export const runtime = "nodejs";

/** What this viewer has blocked and saved, so the feed can act on it. */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ signedIn: false, blocked: [], saved: [] });
  return NextResponse.json({ signedIn: true, ...(await getViewerState(email)) });
}

type Body = {
  action?: "block" | "save" | "report";
  username?: string;
  postId?: string;
  authorName?: string;
  reason?: string;
  on?: boolean;
};

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  // All three are a stance one account takes, so all three need an account.
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }
  if (!moderationConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Moderation storage isn't configured." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  try {
    if (body.action === "block") {
      const username = (body.username ?? "").trim();
      if (!username) {
        return NextResponse.json({ ok: false, error: "Which account?" }, { status: 400 });
      }
      const blocked = await setBlocked(email, username, body.on !== false);
      return NextResponse.json({ ok: true, blocked });
    }

    if (body.action === "save") {
      const postId = (body.postId ?? "").trim();
      if (!postId) {
        return NextResponse.json({ ok: false, error: "Which clip?" }, { status: 400 });
      }
      const saved = await setSaved(email, postId, body.on !== false);
      return NextResponse.json({ ok: true, saved });
    }

    if (body.action === "report") {
      const postId = (body.postId ?? "").trim();
      if (!postId) {
        return NextResponse.json({ ok: false, error: "Which clip?" }, { status: 400 });
      }
      if (!isReportReason(body.reason)) {
        return NextResponse.json({ ok: false, error: "Pick a reason." }, { status: 400 });
      }
      await addReport({
        email,
        postId,
        authorName: (body.authorName ?? "").slice(0, 60),
        reason: body.reason,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (e) {
    const down = e instanceof ModerationError;
    console.error("moderation write failed:", e);
    return NextResponse.json(
      { ok: false, error: down ? "Storage is unavailable — try again." : "That didn't work." },
      { status: down ? 503 : 500 },
    );
  }
}

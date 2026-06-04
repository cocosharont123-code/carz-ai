import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPost, listPosts, feedConfigured } from "@/lib/feed";
import { verifyPostToken } from "@/lib/posttoken";
import { getProfile } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!feedConfigured()) return NextResponse.json({ configured: false, posts: [] });
  const posts = await listPosts(30);
  return NextResponse.json({ configured: true, posts });
}

export async function POST(req: Request) {
  if (!feedConfigured()) {
    return NextResponse.json({ ok: false, error: "The feed isn't connected yet." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Please sign in to post." }, { status: 401 });
  }
  const profile = await getProfile(session.user.email);
  if (!profile?.username) {
    return NextResponse.json(
      { ok: false, needUsername: true, error: "Pick a username before posting." },
      { status: 400 },
    );
  }
  let body: {
    image?: string;
    make?: string;
    model?: string;
    yearRange?: string;
    caption?: string;
    token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  // Enforce: you can only post a car you actually identified through the app.
  if (!verifyPostToken(body.token || "", body.make || "", body.model || "")) {
    return NextResponse.json(
      { ok: false, error: "You can only post a car you've just identified." },
      { status: 403 },
    );
  }
  const res = await createPost(
    { username: profile.username, displayName: profile.displayName, image: profile.image },
    {
      image: body.image || "",
      make: body.make || "",
      model: body.model || "",
      yearRange: body.yearRange || "",
      caption: body.caption || "",
    },
  );
  if (!res.ok) return NextResponse.json(res, { status: 400 });
  return NextResponse.json(res);
}

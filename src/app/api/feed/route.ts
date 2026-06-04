import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createPost, listPosts, feedConfigured } from "@/lib/feed";

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
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Please sign in to post." }, { status: 401 });
  }
  let body: { image?: string; make?: string; model?: string; yearRange?: string; caption?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const res = await createPost(
    { name: session.user.name, image: session.user.image },
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

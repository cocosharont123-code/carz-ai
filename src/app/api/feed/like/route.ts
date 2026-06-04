import { NextResponse } from "next/server";
import { likePost, feedConfigured } from "@/lib/feed";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!feedConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ ok: false }, { status: 400 });
  const likes = await likePost(body.id);
  return NextResponse.json({ ok: true, likes });
}

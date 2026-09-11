import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setFollow, followsConfigured, FollowsError } from "@/lib/follows-blob";

export const runtime = "nodejs";

// POST follows, DELETE unfollows. Both return the counts the button needs, so
// the UI never has to guess what the number became.
async function toggle(on: boolean, params: Promise<{ username: string }>) {
  const { username: raw } = await params;
  const username = decodeURIComponent(raw).replace(/^@/, "");

  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Sign in to follow." }, { status: 401 });
  }
  if (!followsConfigured()) {
    return NextResponse.json({ error: "Following isn't connected yet." }, { status: 503 });
  }

  try {
    return NextResponse.json(await setFollow(email, username, on));
  } catch (e) {
    const message = e instanceof FollowsError ? e.message : "Couldn't save that.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export const POST = (_r: Request, ctx: { params: Promise<{ username: string }> }) =>
  toggle(true, ctx.params);
export const DELETE = (_r: Request, ctx: { params: Promise<{ username: string }> }) =>
  toggle(false, ctx.params);

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { setHomeHeroPhoto } from "@/lib/profile-blob";

export const runtime = "nodejs";

/**
 * Set or clear the home page hero photo.
 *
 * Its own route rather than a field on /api/profile, because that one takes a
 * whole profile and validates the username with it: picking a background should
 * not fail because a username needs attention, and should not require the
 * client to send every other field back to change one picture.
 *
 * The session decides whose profile is written. Nothing in the body names a
 * user, so there is no account to spoof by editing a request.
 */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  let body: { photo?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // null clears it; a string sets it. Anything else is a malformed request
  // rather than something to guess at.
  const photo = body.photo === null ? null : typeof body.photo === "string" ? body.photo : undefined;
  if (photo === undefined) {
    return NextResponse.json({ ok: false, error: "photo must be a string or null" }, { status: 400 });
  }

  try {
    const r = await setHomeHeroPhoto(email, photo);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("home hero save failed:", e);
    return NextResponse.json({ ok: false, error: "Couldn't save that." }, { status: 503 });
  }
}

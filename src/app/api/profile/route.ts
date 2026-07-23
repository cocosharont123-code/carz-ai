import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getProfile, setProfile, profilesConfigured } from "@/lib/profile-blob";

export const runtime = "nodejs";

const UNAME_COOKIE = "cs_uname";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ signedIn: false, profile: null });
  }
  if (!profilesConfigured()) {
    return NextResponse.json({ signedIn: true, configured: false, profile: null });
  }

  const jar = await cookies();
  const profile = await getProfile(email);

  if (profile?.username) {
    // Keep the fast-path cookie fresh so future reads never loop.
    jar.set(UNAME_COOKIE, profile.username, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return NextResponse.json({ signedIn: true, configured: true, profile });
  }

  // Blob write may not have propagated yet (eventual consistency). If we just
  // saved a username, trust the cookie so the user isn't bounced back.
  const cookieName = jar.get(UNAME_COOKIE)?.value;
  if (cookieName) {
    return NextResponse.json({
      signedIn: true,
      configured: true,
      pending: true,
      profile: { username: cookieName, displayName: cookieName, image: "", ts: 0 },
    });
  }

  return NextResponse.json({ signedIn: true, configured: true, profile: null });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }
  if (!profilesConfigured()) {
    return NextResponse.json({ ok: false, error: "Profiles are not configured." }, { status: 503 });
  }

  let body: { username?: string; displayName?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  let res;
  try {
    res = await setProfile(email, {
      username: body.username || "",
      displayName: body.displayName,
      image: body.image,
    });
  } catch (e) {
    // Never let a Blob/storage error surface as an opaque 500 (which the client
    // reads as a generic "Network error"). Return the real reason instead.
    console.error("profile save failed:", e);
    return NextResponse.json(
      { ok: false, error: "Couldn't save your profile right now. Please try again." },
      { status: 500 },
    );
  }
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  // Set an instant, strongly-consistent cookie so the profile gate accepts the
  // new username immediately, before the Blob write finishes propagating.
  const jar = await cookies();
  jar.set(UNAME_COOKIE, res.profile!.username, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, profile: res.profile });
}

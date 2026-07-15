import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProfile, setProfile, profilesConfigured } from "@/lib/profile-blob";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ signedIn: false, profile: null });
  }
  if (!profilesConfigured()) {
    return NextResponse.json({ signedIn: true, configured: false, profile: null });
  }
  const profile = await getProfile(email);
  return NextResponse.json({ signedIn: true, configured: true, profile });
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

  const res = await setProfile(email, {
    username: body.username || "",
    displayName: body.displayName,
    image: body.image,
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, profile: res.profile });
}

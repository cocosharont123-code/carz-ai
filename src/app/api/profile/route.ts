import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProfile, setProfile, profileConfigured } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ configured: profileConfigured(), signedIn: false, profile: null });
  }
  const profile = await getProfile(session.user.email);
  return NextResponse.json({ configured: profileConfigured(), signedIn: true, profile });
}

export async function POST(req: Request) {
  if (!profileConfigured()) {
    return NextResponse.json({ ok: false, error: "Profiles aren't enabled yet." }, { status: 503 });
  }
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  let body: { username?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const res = await setProfile(session.user.email, {
    username: body.username || "",
    displayName: body.displayName,
    image: session.user.image || "",
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}

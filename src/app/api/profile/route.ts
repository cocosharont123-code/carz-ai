import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { ensureProfile, setProfile, profilesConfigured, ProfileStorageError } from "@/lib/profile-blob";

export const runtime = "nodejs";

const UNAME_COOKIE = "cs_uname";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    // `configured` here (no secrets) lets us confirm the profile route's own
    // view of storage on a live deployment without needing to sign in.
    return NextResponse.json({ signedIn: false, configured: profilesConfigured(), profile: null });
  }
  const jar = await cookies();

  // Everyone gets a profile on first sight — no setup form, no gate. Falls back
  // to a generated identity when storage is missing or down, so signing in
  // still works and the app always has a name to show.
  const { profile, stored } = await ensureProfile(email);

  // A name the user chose themselves beats the generated one. If storage is
  // unreachable, `ensureProfile` can only offer the generated name, so prefer
  // the cookie from their last good read rather than appearing to rename them.
  const cached = jar.get(UNAME_COOKIE)?.value;
  if (!stored && cached && cached !== profile.username) {
    return NextResponse.json({
      signedIn: true,
      configured: profilesConfigured(),
      unavailable: true,
      profile: { ...profile, username: cached, displayName: cached },
    });
  }

  // Keep the fast-path cookie fresh so future reads never loop.
  jar.set(UNAME_COOKIE, profile.username, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({
    signedIn: true,
    configured: profilesConfigured(),
    // Storage didn't accept the write; the name is still usable, just not durable.
    unavailable: !stored,
    profile,
  });
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
    // Surface the real storage reason (e.g. missing/expired BLOB_READ_WRITE_TOKEN
    // or a disconnected Blob store) so "account making" failures are diagnosable
    // instead of hiding behind a generic message.
    console.error("profile save failed:", e);
    const down = e instanceof ProfileStorageError;
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        unavailable: down,
        error: down
          ? `Profile storage is unavailable: ${detail}`
          : `Couldn't save your profile: ${detail}`,
        detail,
      },
      { status: down ? 503 : 500 },
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

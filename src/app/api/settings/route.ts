import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getProfile, isActiveMember } from "@/lib/profile-blob";
import {
  SCAN_MODE_COOKIE,
  DEFAULT_SCAN_MODE,
  isScanMode,
  effectiveScanMode,
} from "@/lib/scan-mode";

export const runtime = "nodejs";

async function memberNow(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.email) return false;
  return isActiveMember(await getProfile(session.user.email));
}

// GET -> the settings the spotter has, plus whether Precise is theirs to pick.
// `scanMode` is what they chose; `effectiveScanMode` is what a scan will really
// run as, which differs once a membership lapses with the cookie still set.
export async function GET() {
  const jar = await cookies();
  const stored = jar.get(SCAN_MODE_COOKIE)?.value;
  const member = await memberNow();
  return NextResponse.json({
    member,
    scanMode: isScanMode(stored) ? stored : DEFAULT_SCAN_MODE,
    effectiveScanMode: effectiveScanMode(stored, member),
  });
}

// POST { scanMode } -> save the preference.
export async function POST(req: Request) {
  let body: { scanMode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  if (!isScanMode(body.scanMode)) {
    return NextResponse.json({ ok: false, error: "Unknown scan mode." }, { status: 400 });
  }

  const member = await memberNow();
  // The UI locks Precise behind membership, but the cookie is the thing the
  // scan route trusts, so the gate has to live here too rather than only in
  // the page that sets it.
  if (body.scanMode === "precise" && !member) {
    return NextResponse.json(
      { ok: false, error: "Precise scanning is a Carz+ feature.", member: false },
      { status: 402 },
    );
  }

  const jar = await cookies();
  jar.set(SCAN_MODE_COOKIE, body.scanMode, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true, scanMode: body.scanMode, member });
}

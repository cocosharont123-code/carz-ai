import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getProfile,
  setMembership,
  touchStreak,
  restoreStreak,
  profilesConfigured,
} from "@/lib/profile-blob";

export const runtime = "nodejs";

// Promo codes that unlock Carz+ for free. Matched case-insensitively.
const PROMO_CODES = new Set(["carz+100"]);

// GET → current membership + streak status.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !profilesConfigured()) {
    return NextResponse.json({ signedIn: !!email, member: false, streak: 0 });
  }
  // Bump the streak on visit (members only), then report.
  const p = (await touchStreak(email)) ?? (await getProfile(email));
  return NextResponse.json({
    signedIn: true,
    hasUsername: !!p?.username,
    member: !!p?.member,
    memberSince: p?.memberSince ?? null,
    streak: p?.streak ?? 0,
  });
}

// POST → join / restore-streak. Real billing needs a payment provider (Stripe);
// this flips the account flag so the membership + gating work end-to-end.
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }
  const profile = await getProfile(email);
  if (!profile?.username) {
    return NextResponse.json({ ok: false, error: "Set a username first.", needUsername: true }, { status: 400 });
  }

  let body: { action?: string; restoreTo?: number; code?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.action === "restore") {
    const p = await restoreStreak(email, Number(body.restoreTo) || 0);
    return NextResponse.json({ ok: true, streak: p?.streak ?? 0 });
  }

  if (body.action === "redeem") {
    const code = (body.code ?? "").trim().toLowerCase();
    if (!PROMO_CODES.has(code)) {
      return NextResponse.json({ ok: false, error: "That promo code isn't valid." }, { status: 400 });
    }
    const p = await setMembership(email, true);
    return NextResponse.json({ ok: true, member: !!p?.member, promo: true, streak: p?.streak ?? 0 });
  }

  // Default: join Carz+.
  const p = await setMembership(email, true);
  return NextResponse.json({ ok: true, member: !!p?.member, streak: p?.streak ?? 0 });
}

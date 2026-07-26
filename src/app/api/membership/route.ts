import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getProfile,
  setMembership,
  startTrial,
  touchStreak,
  restoreStreak,
  isActiveMember,
  profilesConfigured,
} from "@/lib/profile-blob";
import { lookupPromo } from "@/lib/promos";

export const runtime = "nodejs";

// GET → current membership + streak status.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !profilesConfigured()) {
    return NextResponse.json({ signedIn: !!email, member: false, streak: 0 });
  }
  // Bump the streak on visit (members only), then report.
  const p = (await touchStreak(email)) ?? (await getProfile(email));
  const active = isActiveMember(p);
  return NextResponse.json({
    signedIn: true,
    hasUsername: !!p?.username,
    member: active,
    memberSince: p?.memberSince ?? null,
    billing: p?.billing ?? "monthly",
    trialEndsAt: active && p?.trialEndsAt ? p.trialEndsAt : null,
    trialUsed: !!p?.trialUsed,
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

  let body: { action?: string; restoreTo?: number; code?: string; interval?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.action === "restore") {
    const p = await restoreStreak(email, Number(body.restoreTo) || 0);
    return NextResponse.json({ ok: true, streak: p?.streak ?? 0 });
  }

  if (body.action === "trial") {
    const r = await startTrial(email);
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      member: true,
      trial: true,
      trialEndsAt: r.profile?.trialEndsAt ?? null,
      streak: r.profile?.streak ?? 0,
    });
  }

  if (body.action === "redeem") {
    const promo = lookupPromo(body.code ?? "");
    if (!promo) {
      return NextResponse.json({ ok: false, error: "That promo code isn't valid." }, { status: 400 });
    }
    // 100%-off codes unlock Carz+ outright; partial codes only discount the
    // price, so the member still joins (at the reduced rate) to activate.
    if (promo.percentOff >= 100) {
      const p = await setMembership(email, true);
      return NextResponse.json({ ok: true, member: !!p?.member, promo: true, percentOff: 100, streak: p?.streak ?? 0 });
    }
    return NextResponse.json({ ok: true, member: false, promo: true, percentOff: promo.percentOff, discountOnly: true });
  }

  // Default: join Carz+ on the chosen billing interval (monthly or annual).
  const interval = body.interval === "annual" ? "annual" : "monthly";
  const p = await setMembership(email, true, interval);
  return NextResponse.json({ ok: true, member: !!p?.member, billing: p?.billing ?? "monthly", streak: p?.streak ?? 0 });
}

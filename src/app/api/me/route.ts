import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, getUser, planStatusFor, recentHistory, UID_COOKIE, PLAN_COOKIE, isPlanId } from "@/lib/store";
import { PLANS } from "@/lib/plans";
import { auth } from "@/auth";
import { ensureProfile, isActiveMember } from "@/lib/profile-blob";

export const runtime = "nodejs";

export async function GET() {
  const { id, isNew } = await getUserId();
  const jar = await cookies();
  if (isNew) {
    jar.set(UID_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  const user = getUser(id);
  const cookiePlan = jar.get(PLAN_COOKIE)?.value;
  const effectivePlan = isPlanId(cookiePlan) ? cookiePlan : user.plan;
  const status = planStatusFor(effectivePlan, user);

  const session = await auth();
  let member = false;
  let username: string | null = null;
  if (session?.user?.email) {
    // Provisions a generated-name profile on first sight. /api/me is hit from
    // most pages, so an account is set up without anyone visiting /profile.
    const { profile } = await ensureProfile(session.user.email);
    member = isActiveMember(profile);
    username = profile.username;
  }

  return NextResponse.json({
    ...status,
    member,
    username,
    plans: PLANS,
    apiConfigured: !!process.env.ANTHROPIC_API_KEY,
    authEnabled: !!process.env.AUTH_GOOGLE_ID,
    history: status.saveHistory ? recentHistory(user) : [],
    totalSpots: user.totalSpots ?? 0,
  });
}

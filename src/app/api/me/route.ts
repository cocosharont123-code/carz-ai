import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, getUser, planStatusFor, recentHistory, UID_COOKIE, PLAN_COOKIE, isPlanId } from "@/lib/store";
import { PLANS } from "@/lib/plans";
import { badgesFor, goalsForDate } from "@/lib/gamification";
import { auth } from "@/auth";
import { getProfile } from "@/lib/profile-blob";

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
  if (session?.user?.email) {
    const profile = await getProfile(session.user.email);
    member = !!profile?.member;
  }

  const today = new Date().toISOString().slice(0, 10);
  const done = user.goalsDone?.[today] ?? [];
  return NextResponse.json({
    ...status,
    member,
    plans: PLANS,
    apiConfigured: !!process.env.ANTHROPIC_API_KEY,
    authEnabled: !!process.env.AUTH_GOOGLE_ID,
    history: status.saveHistory ? recentHistory(user) : [],
    totalSpots: user.totalSpots ?? 0,
    badges: badgesFor(user.totalSpots ?? 0),
    goals: goalsForDate(today).map((g) => ({ id: g.id, label: g.label, done: done.includes(g.id) })),
  });
}

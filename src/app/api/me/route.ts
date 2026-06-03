import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, getUser, planStatus, recentHistory, UID_COOKIE } from "@/lib/store";
import { PLANS } from "@/lib/plans";
import { badgesFor, goalsForDate } from "@/lib/gamification";

export const runtime = "nodejs";

export async function GET() {
  const { id, isNew } = await getUserId();
  if (isNew) {
    const jar = await cookies();
    jar.set(UID_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  const user = getUser(id);
  const status = planStatus(user);
  const today = new Date().toISOString().slice(0, 10);
  const done = user.goalsDone?.[today] ?? [];
  return NextResponse.json({
    ...status,
    plans: PLANS,
    apiConfigured: !!process.env.ANTHROPIC_API_KEY,
    history: status.saveHistory ? recentHistory(user) : [],
    totalSpots: user.totalSpots ?? 0,
    badges: badgesFor(user.totalSpots ?? 0),
    goals: goalsForDate(today).map((g) => ({ id: g.id, label: g.label, done: done.includes(g.id) })),
  });
}

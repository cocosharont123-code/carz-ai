import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMyStats, leaderboardConfigured } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !leaderboardConfigured()) {
    return NextResponse.json({ streak: 0, points: 0, spots: 0, signedIn: !!session?.user });
  }
  const stats = await getMyStats(session.user.email);
  return NextResponse.json({ ...stats, signedIn: true });
}

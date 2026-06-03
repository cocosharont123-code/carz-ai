import { NextResponse } from "next/server";
import { topSpotters, bestCarOverall, leaderboardConfigured } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!leaderboardConfigured()) {
    return NextResponse.json({ configured: false, entries: [], bestCar: null });
  }
  const [entries, bestCar] = await Promise.all([topSpotters(20), bestCarOverall()]);
  return NextResponse.json({ configured: true, entries, bestCar });
}

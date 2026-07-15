import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readBoard, recordRareSpot, leaderboardConfigured } from "@/lib/leaderboard-blob";
import { getProfile } from "@/lib/profile-blob";

export const runtime = "nodejs";

export async function GET() {
  if (!leaderboardConfigured()) {
    return NextResponse.json({ configured: false, cars: [] });
  }
  const cars = await readBoard();
  return NextResponse.json({ configured: true, cars });
}

export async function POST(req: Request) {
  if (!leaderboardConfigured()) {
    return NextResponse.json({ ok: false, configured: false });
  }

  let body: {
    image?: string;
    make?: string;
    model?: string;
    yearRange?: string;
    rarityScore?: number;
    rarityReason?: string;
    priceRange?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const make = (body.make || "").trim();
  const model = (body.model || "").trim();
  const rarityScore = Number(body.rarityScore) || 0;
  if (!make || !model || rarityScore <= 0) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }

  // Spotter identity comes from the server-side profile, not the client (no spoofing).
  const session = await auth();
  let spotter = "Anonymous";
  let spotterImage = "";
  if (session?.user?.email) {
    const profile = await getProfile(session.user.email);
    if (profile?.username) {
      spotter = `@${profile.username}`;
      spotterImage = profile.image || "";
    } else {
      spotter = session.user.name?.split(" ")[0] || "Anonymous";
    }
  }

  // Keep the stored thumbnail small so the JSON stays lean.
  const image = typeof body.image === "string" && body.image.startsWith("data:") ? body.image.slice(0, 60_000) : "";

  try {
    await recordRareSpot({
      make,
      model,
      yearRange: (body.yearRange || "").trim(),
      rarityScore: Math.max(0, Math.min(100, rarityScore)),
      rarityReason: (body.rarityReason || "").trim(),
      priceRange: (body.priceRange || "").trim(),
      image,
      spotter,
      spotterImage,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "record_failed" }, { status: 502 });
  }
}

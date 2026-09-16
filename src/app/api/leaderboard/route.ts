import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readBoard, recordRareSpot, leaderboardConfigured } from "@/lib/leaderboard-blob";
import { ensureProfile, memberUsernames } from "@/lib/profile-blob";

export const runtime = "nodejs";

export async function GET() {
  if (!leaderboardConfigured()) {
    return NextResponse.json({ configured: false, cars: [] });
  }
  const cars = await readBoard();
  // Flag which spotters are current Carz+ members so the board can badge them.
  const members = await memberUsernames();
  const withMembership = cars.map((c) => ({
    ...c,
    spotterMember: c.spotter.startsWith("@") && members.has(c.spotter.slice(1).toLowerCase()),
  }));
  return NextResponse.json({ configured: true, cars: withMembership });
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
    // Always a username — generated on first sight if they never picked one.
    const { profile } = await ensureProfile(session.user.email);
    spotter = `@${profile.username}`;
    spotterImage = profile.image || "";
  }

  // Keep the stored thumbnail small so the JSON stays lean.
  // Dropped whole rather than sliced when it is too big. Cutting a base64
  // data URL at a byte limit does not produce a smaller image, it produces a
  // broken one — every entry over the old 60,000 cap was being stored as a
  // corrupt JPEG that would never render.
  const rawImage = typeof body.image === "string" ? body.image : "";
  const image =
    rawImage.startsWith("data:image/") && rawImage.length <= 180_000 ? rawImage : "";

  try {
    await recordRareSpot({
      make,
      model,
      yearRange: (body.yearRange || "").trim(),
      rarityScore: Math.max(0, Math.min(120, rarityScore)),
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

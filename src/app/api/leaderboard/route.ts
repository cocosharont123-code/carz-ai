import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  readBoard,
  recordRareSpot,
  uploadLeaderboardPhoto,
  leaderboardConfigured,
} from "@/lib/leaderboard-blob";
import type { CarSpecs } from "@/lib/leaderboard-blob";
import { ensureProfile, memberUsernames } from "@/lib/profile-blob";

export const runtime = "nodejs";

/**
 * Copy across only the fields the stat sheet draws, each capped.
 *
 * This document is served from a public URL and rewritten whole on every spot,
 * so what goes in is whitelisted rather than spread: an unbounded object from a
 * client would be both an unbounded document and whatever the client felt like
 * publishing.
 */
const SPEC_TEXT = [
  "engine", "drivetrain", "bodyStyle", "generation", "trimGuess", "color",
  "countryOfOrigin", "parentCompany", "horsepower", "zeroToSixty", "topSpeed",
  "priceRangeUsed", "valuation", "reliability", "collectibility",
] as const;

function pickSpecs(raw: unknown): CarSpecs | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of SPEC_TEXT) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 400);
  }
  if (Array.isArray(src.valueTimeline)) {
    const points = src.valueTimeline
      .filter((p): p is { year: string; usd: number } =>
        !!p && typeof p === "object" &&
        typeof (p as { year?: unknown }).year === "string" &&
        typeof (p as { usd?: unknown }).usd === "number")
      .slice(0, 8)
      .map((p) => ({ year: p.year.slice(0, 12), usd: p.usd }));
    if (points.length) out.valueTimeline = points;
  }
  return Object.keys(out).length ? (out as CarSpecs) : undefined;
}

export async function GET() {
  if (!leaderboardConfigured()) {
    return NextResponse.json({ configured: false, cars: [] });
  }
  const cars = await readBoard();
  // Flag which spotters are current Carz PRO members so the board can badge them.
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
    specs?: Record<string, unknown>;
    make?: string;
    model?: string;
    yearRange?: string;
    rarityScore?: number;
    rarityReason?: string;
    priceRange?: string;
    /** Ties this entry to the map pin from the same scan. */
    scanId?: string;
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

  // The photo goes to Blob as a file and only its URL is kept. Embedding a
  // 1000px image in the board's JSON would put roughly 8MB in a document that
  // is read and rewritten in full on every spot.
  //
  // Best effort: a car that earns a place on the board should not lose it
  // because its photo failed to store. It simply has no photo.
  const rawImage = typeof body.image === "string" ? body.image : "";
  let image = "";
  if (rawImage.startsWith("data:image/")) {
    try {
      image = await uploadLeaderboardPhoto(
        rawImage,
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      );
    } catch (e) {
      console.error("leaderboard photo upload failed:", e);
    }
  }

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
      specs: pickSpecs(body.specs),
      scanId: typeof body.scanId === "string" ? body.scanId.slice(0, 40) : undefined,
    });
    // photo says whether the image actually stored. The upload is best effort --
    // a car that earns a place should not lose it because its photo failed --
    // but "best effort" was indistinguishable from success here, so a board full
    // of missing pictures looked like a rendering bug rather than a storage one.
    return NextResponse.json({ ok: true, photo: !!image });
  } catch {
    return NextResponse.json({ ok: false, error: "record_failed" }, { status: 502 });
  }
}

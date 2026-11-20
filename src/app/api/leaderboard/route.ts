import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  readBoard,
  recordRareSpot,
  uploadLeaderboardPhoto,
  leaderboardConfigured,
} from "@/lib/leaderboard-blob";
import { ensureProfile, memberUsernames } from "@/lib/profile-blob";

export const runtime = "nodejs";

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
    make?: string;
    model?: string;
    yearRange?: string;
    rarityScore?: number;
    rarityReason?: string;
    priceRange?: string;
    /** Ties this entry to the map pin from the same scan. */
    scanId?: string;
    /**
     * Whether the photo came from a camera rather than the library.
     *
     * The client is the only witness to this, the same way it is for a map
     * pin -- nothing in an image proves where it came from, and EXIF is both
     * absent on a canvas capture and trivially written by anyone who wants
     * to. What this check buys is that the ordinary path cannot put a press
     * shot on the board by accident, which is what was happening.
     */
    live?: boolean;
    /**
     * How sure the identification was: "high", "medium" or "low".
     *
     * Sent so the board can refuse a guess. Absent on anything posting from
     * an older client, which is read as "not stated" rather than as low --
     * the rule below only turns away what is positively unidentified.
     */
    confidence?: string;
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

  // Live captures only. See `live` above for what this can and cannot
  // promise. 200 rather than 400: a scan from the library is a perfectly good
  // scan that simply does not rank, and the client treats this call as
  // best-effort either way.
  if (body.live !== true) {
    return NextResponse.json({ ok: true, ranked: false, reason: "not a live capture" });
  }

  /**
   * Identified cars only.
   *
   * A scan that could not name what it was looking at still produces a row --
   * the model fills the fields it has to fill, and what comes back is
   * "Unknown", "Unidentified", "Unknown SUV", a question mark, or the word
   * sitting in the model while the make is blank. On a board of the rarest
   * cars anyone has found, an unknown is the one thing that cannot be rare:
   * nobody knows what it is.
   *
   * Low confidence goes with it. The pipeline says so itself when two looks
   * disagreed and the adjudicator was not convinced, and a contested guess is
   * not a find.
   */
  const unknown = /^(unknown|unidentified|unrecognis(ed|zed)|not identified|n\/?a|\?+)$/i;
  const looksUnknown = (v: string) => !v || unknown.test(v.trim());
  if (
    looksUnknown(make) ||
    looksUnknown(model) ||
    unknown.test(`${make} ${model}`.trim()) ||
    (typeof body.confidence === "string" && body.confidence.toLowerCase() === "low")
  ) {
    return NextResponse.json({ ok: true, ranked: false, reason: "not identified" });
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

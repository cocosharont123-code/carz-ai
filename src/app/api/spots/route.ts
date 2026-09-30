import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/profile-blob";
import { listSpots, recordSpot, spotsConfigured, SpotsError } from "@/lib/spots-blob";

export const runtime = "nodejs";

/** Every recent spot, for the map. Public: the map is. */
export async function GET() {
  if (!spotsConfigured()) return NextResponse.json({ configured: false, spots: [] });
  try {
    return NextResponse.json({ configured: true, spots: await listSpots() });
  } catch (e) {
    console.error("spots read failed:", e);
    return NextResponse.json({ configured: true, spots: [] });
  }
}

/**
 * Record a spot.
 *
 * Signed in only — a pin carries a name, and an anonymous pin is a pin nobody
 * can stand behind.
 *
 * `live` is the claim that this came from the camera rather than the photo
 * library, and it is exactly that: a claim the client makes about itself. The
 * server cannot verify where a JPEG came from, so this keeps honest spots
 * honest and nothing more. It is a map of car sightings, not a ledger — if it
 * ever decides anything that matters, this needs a real attestation.
 */
export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in to put a car on the map." }, { status: 401 });
  }
  if (!spotsConfigured()) {
    return NextResponse.json({ ok: false, error: "Spots storage isn't configured." }, { status: 503 });
  }

  let body: {
    lat?: number;
    lng?: number;
    make?: string;
    model?: string;
    yearRange?: string;
    carName?: string;
    rarityScore?: number;
    live?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // Not a live capture, so it does not go on the map. Not an error: the scan
  // itself worked, and the page has nothing to apologise for.
  if (body.live !== true) {
    return NextResponse.json({ ok: true, recorded: false, reason: "not-live" });
  }

  const make = (body.make ?? "").trim();
  const model = (body.model ?? "").trim();
  if (!make || !model) {
    return NextResponse.json({ ok: false, error: "No car to place." }, { status: 400 });
  }

  try {
    const { profile } = await ensureProfile(email);
    const spot = await recordSpot({
      lat: Number(body.lat),
      lng: Number(body.lng),
      make,
      model,
      yearRange: body.yearRange,
      carName: body.carName,
      rarityScore: Number(body.rarityScore) || 0,
      spotter: `@${profile.username}`,
    });
    // recordSpot returns null when the coordinates are not usable.
    return NextResponse.json({ ok: true, recorded: !!spot, spot });
  } catch (e) {
    console.error("spot write failed:", e);
    const down = e instanceof SpotsError;
    return NextResponse.json({ ok: false, error: "Couldn't save that spot." }, { status: down ? 503 : 500 });
  }
}

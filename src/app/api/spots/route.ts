import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/profile-blob";
import { listSpots, recordSpot, validCoords, spotsConfigured, SpotsError } from "@/lib/spots-blob";

export const runtime = "nodejs";

/** The map's data. Public: it is a map of cars, with no account attached. */
export async function GET() {
  if (!spotsConfigured()) return NextResponse.json({ configured: false, spots: [] });
  try {
    return NextResponse.json({ configured: true, spots: await listSpots() });
  } catch (e) {
    console.error("spots read failed:", e);
    return NextResponse.json({ configured: true, spots: [] });
  }
}

type Body = {
  make?: string;
  model?: string;
  yearRange?: string;
  lng?: number;
  lat?: number;
  rarityScore?: number;
  /** True only when the photo came from the camera, not the library. */
  live?: boolean;
};

export async function POST(req: Request) {
  if (!spotsConfigured()) {
    return NextResponse.json({ ok: false, error: "Spots aren't configured." }, { status: 503 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // The whole point of the map. A library photo could have been taken anywhere,
  // years ago, by somebody else, and pinning it to wherever the phone is
  // standing now would put a lie on it. Refused rather than quietly dropped, so
  // a client sending one learns that it did.
  if (body.live !== true) {
    return NextResponse.json(
      { ok: false, error: "Only cars photographed in the app are mapped." },
      { status: 400 },
    );
  }

  if (!validCoords(body.lng, body.lat)) {
    return NextResponse.json({ ok: false, error: "No usable location." }, { status: 400 });
  }

  const make = (body.make ?? "").trim();
  const model = (body.model ?? "").trim();
  if (!make || !model) {
    return NextResponse.json({ ok: false, error: "Which car?" }, { status: 400 });
  }

  // Signing in is not required to spot, so it is not required to appear. An
  // unsigned spot is on the map as Anonymous rather than not on it.
  let spotter = "Anonymous";
  const session = await auth();
  if (session?.user?.email) {
    try {
      const { profile } = await ensureProfile(session.user.email);
      spotter = `@${profile.username}`;
    } catch {
      /* a name is not worth failing the spot over */
    }
  }

  try {
    await recordSpot({
      make,
      model,
      yearRange: (body.yearRange ?? "").trim(),
      lng: body.lng as number,
      lat: body.lat as number,
      spotter,
      rarityScore: Number(body.rarityScore) || 0,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("spot write failed:", e);
    const down = e instanceof SpotsError;
    return NextResponse.json({ ok: false }, { status: down ? 503 : 500 });
  }
}

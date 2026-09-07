import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/profile-blob";
import {
  nearbyConfigured,
  readRecent,
  recordLiveSpot,
  near,
  RADIUS_KM,
  WINDOW_MS,
} from "@/lib/nearby-blob";

export const runtime = "nodejs";

// GET /api/nearby?lat=&lon=  — cars caught on the live camera near here, last 2h.
export async function GET(req: Request) {
  if (!nearbyConfigured()) {
    return NextResponse.json({ configured: false, spots: [] });
  }

  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    // Without a location there is no "near you" to answer — say so rather than
    // falling back to a global feed, which would quietly be a different feature.
    return NextResponse.json(
      { configured: true, located: false, spots: [], radiusKm: RADIUS_KM, windowMs: WINDOW_MS },
      { status: 400 },
    );
  }

  const spots = near(await readRecent(), lat, lon).map((s) => ({
    id: s.id,
    make: s.make,
    model: s.model,
    yearRange: s.yearRange,
    image: s.image,
    rarityScore: s.rarityScore,
    priceRange: s.priceRange,
    spotter: s.spotter,
    spotterImage: s.spotterImage,
    ts: s.ts,
    km: Math.round(s.km * 10) / 10,
    // The stored coordinate is already coarse, but the feed has no map — so it
    // ships the distance and keeps the position server-side entirely.
  }));

  return NextResponse.json({
    configured: true,
    located: true,
    spots,
    radiusKm: RADIUS_KM,
    windowMs: WINDOW_MS,
  });
}

// POST — record a car just caught on the live in-app camera.
export async function POST(req: Request) {
  if (!nearbyConfigured()) {
    return NextResponse.json({ ok: false, configured: false });
  }

  let body: {
    live?: boolean;
    make?: string;
    model?: string;
    yearRange?: string;
    image?: string;
    rarityScore?: number;
    priceRange?: string;
    lat?: number;
    lon?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // The feed is defined as live-camera spots only, so a photo that didn't come
  // from the viewfinder is refused rather than silently downgraded.
  //
  // Worth being straight about how strong this check is: `live` is asserted by
  // the client. A browser cannot prove an image came from getUserMedia rather
  // than a file picker, and nothing server-side can tell the two apart — the
  // pixels are identical. This keeps camera-roll uploads out of the feed by
  // construction (the upload path never sets it), not by proof.
  if (body.live !== true) {
    return NextResponse.json({ ok: false, error: "live_camera_only" }, { status: 400 });
  }

  const make = (body.make || "").trim();
  const model = (body.model || "").trim();
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (!make || !model) {
    return NextResponse.json({ ok: false, error: "missing fields" }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ ok: false, error: "bad location" }, { status: 400 });
  }

  // Identity comes from the server-side profile, never the client.
  const session = await auth();
  let spotter = "Anonymous";
  let spotterImage = "";
  if (session?.user?.email) {
    const { profile } = await ensureProfile(session.user.email);
    spotter = `@${profile.username}`;
    spotterImage = profile.image || "";
  }

  const image =
    typeof body.image === "string" && body.image.startsWith("data:") ? body.image.slice(0, 60_000) : "";

  try {
    await recordLiveSpot({
      make,
      model,
      yearRange: (body.yearRange || "").trim(),
      image,
      rarityScore: Math.max(0, Math.min(120, Number(body.rarityScore) || 0)),
      priceRange: (body.priceRange || "").trim(),
      lat,
      lng: lon,
      spotter,
      spotterImage,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "record_failed" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAuction, readAll, toPublic, hashEmail, auctionsConfigured, validateVin } from "@/lib/auctions-blob";
import { ensureProfile } from "@/lib/profile-blob";

export const runtime = "nodejs";

export async function GET() {
  if (!auctionsConfigured()) {
    return NextResponse.json({ configured: false, auctions: [] });
  }
  const session = await auth();
  const viewerHash = session?.user?.email ? hashEmail(session.user.email) : null;

  const all = await readAll();
  // Active first (soonest-ending), then recently ended.
  const now = Date.now();
  all.sort((a, b) => {
    const aEnded = now >= a.endsAt ? 1 : 0;
    const bEnded = now >= b.endsAt ? 1 : 0;
    if (aEnded !== bEnded) return aEnded - bEnded;
    return aEnded ? b.endsAt - a.endsAt : a.endsAt - b.endsAt;
  });
  // Strip the heavy full image + bid history from the list view for speed.
  const auctions = all.slice(0, 60).map((a) => {
    const pub = toPublic(a, viewerHash);
    return { ...pub, bids: [], contact: undefined };
  });
  return NextResponse.json({ configured: true, auctions });
}

export async function POST(req: Request) {
  if (!auctionsConfigured()) {
    return NextResponse.json({ ok: false, error: "Auctions are not configured." }, { status: 503 });
  }
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in to list a car." }, { status: 401 });
  }
  // Everyone has a name the moment they sign in, so listing is never gated.
  const { profile } = await ensureProfile(email);

  let b: {
    title?: string;
    make?: string;
    model?: string;
    year?: string;
    vin?: string;
    description?: string;
    image?: string;
    startingBid?: number;
    contact?: string;
    durationDays?: number;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const title = (b.title || "").trim();
  const year = (b.year || "").trim();
  const contact = (b.contact || "").trim();
  const image = typeof b.image === "string" && b.image.startsWith("data:") ? b.image.slice(0, 90_000) : "";
  const startingBid = Number(b.startingBid);
  if (!title) return NextResponse.json({ ok: false, error: "Give your listing a title." }, { status: 400 });
  if (!year) return NextResponse.json({ ok: false, error: "Enter the car's year." }, { status: 400 });
  // Checked server-side too: the client can be bypassed, and a listing without a
  // real VIN is the one thing a buyer can't verify after the fact.
  const vin = validateVin(b.vin || "");
  if (!vin.ok) return NextResponse.json({ ok: false, error: vin.error }, { status: 400 });
  if (!Number.isFinite(startingBid) || startingBid < 0)
    return NextResponse.json({ ok: false, error: "Enter a starting price." }, { status: 400 });
  if (!contact) return NextResponse.json({ ok: false, error: "Add contact info for the winner." }, { status: 400 });
  if (!image) return NextResponse.json({ ok: false, error: "Add a photo of the car." }, { status: 400 });

  const auction = await createAuction({
    sellerEmail: email,
    sellerName: `@${profile.username}`,
    title,
    make: b.make || "",
    model: b.model || "",
    year,
    vin: vin.value,
    description: b.description || "",
    image,
    startingBid,
    contact,
    durationDays: Number(b.durationDays) || 7,
  });

  return NextResponse.json({ ok: true, id: auction.id });
}

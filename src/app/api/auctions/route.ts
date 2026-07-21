import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAuction, readAll, toPublic, hashEmail, auctionsConfigured } from "@/lib/auctions-blob";
import { getProfile } from "@/lib/profile-blob";

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
  const profile = await getProfile(email);
  if (!profile?.username) {
    return NextResponse.json({ ok: false, error: "Set a username first.", needUsername: true }, { status: 400 });
  }

  let b: {
    title?: string;
    make?: string;
    model?: string;
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
  const contact = (b.contact || "").trim();
  const image = typeof b.image === "string" && b.image.startsWith("data:") ? b.image.slice(0, 90_000) : "";
  if (!title) return NextResponse.json({ ok: false, error: "Give your listing a title." }, { status: 400 });
  if (!contact) return NextResponse.json({ ok: false, error: "Add contact info for the winner." }, { status: 400 });
  if (!image) return NextResponse.json({ ok: false, error: "Add a photo of the car." }, { status: 400 });

  const auction = await createAuction({
    sellerEmail: email,
    sellerName: `@${profile.username}`,
    title,
    make: b.make || "",
    model: b.model || "",
    description: b.description || "",
    image,
    startingBid: Number(b.startingBid) || 0,
    contact,
    durationDays: Number(b.durationDays) || 7,
  });

  return NextResponse.json({ ok: true, id: auction.id });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addClaim, readClaims, claimsConfigured, ownerEmail } from "@/lib/hunt-claims";
import { getProfile } from "@/lib/profile-blob";

export const runtime = "nodejs";

// Owner-only: list all claims to review and pay out.
export async function GET() {
  if (!claimsConfigured()) return NextResponse.json({ configured: false, isOwner: false, claims: [] });
  const session = await auth();
  const isOwner = session?.user?.email?.toLowerCase() === ownerEmail();
  if (!isOwner) {
    return NextResponse.json({ configured: true, isOwner: false, claims: [] });
  }
  const claims = await readClaims();
  return NextResponse.json({ configured: true, isOwner: true, claims });
}

// Anyone who spotted a wanted car can submit a claim with their CashApp tag.
export async function POST(req: Request) {
  if (!claimsConfigured()) {
    return NextResponse.json({ ok: false, error: "Claims are not set up yet." }, { status: 503 });
  }

  let body: { carId?: string; cashapp?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  // Attach a username if the person happens to be signed in (optional).
  let spotter = "Guest";
  const session = await auth();
  if (session?.user?.email) {
    const profile = await getProfile(session.user.email);
    spotter = profile?.username ? `@${profile.username}` : session.user.name?.split(" ")[0] || "Guest";
  }

  const res = await addClaim({
    carId: (body.carId || "").trim(),
    cashapp: body.cashapp || "",
    image: body.image || "",
    spotter,
  });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, bounty: res.claim!.bounty, car: res.claim!.carName });
}

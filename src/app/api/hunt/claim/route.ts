import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addClaim, readClaims, claimsConfigured, ownerEmail } from "@/lib/hunt-claims";
import { ensureProfile, isMaxMember } from "@/lib/profile-blob";

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

  /**
   * Claiming is Carz MAX, and it is checked here rather than only on the screen
   * in front of it.
   *
   * This route used to take a claim from anyone and file it under "Guest" if they
   * were not signed in. The hunt pays real money, so the one request that asks
   * for a payout was the one request with nothing behind it -- a URL and a
   * CashApp tag were enough. The tier is read from the stored profile on every
   * request, so a lapsed membership stops being able to claim at once.
   */
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in to claim a bounty." }, { status: 401 });
  }
  const { profile } = await ensureProfile(email);
  if (!isMaxMember(profile)) {
    return NextResponse.json(
      { ok: false, error: "Claiming a bounty is a Carz MAX feature." },
      { status: 402 },
    );
  }
  const spotter = `@${profile.username}`;

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

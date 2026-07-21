import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { placeBid, getAuction, toPublic, hashEmail, auctionsConfigured } from "@/lib/auctions-blob";
import { getProfile } from "@/lib/profile-blob";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!auctionsConfigured()) {
    return NextResponse.json({ ok: false, error: "Auctions are not configured." }, { status: 503 });
  }
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in to bid." }, { status: 401 });
  }
  const profile = await getProfile(email);
  if (!profile?.username) {
    return NextResponse.json({ ok: false, error: "Set a username first.", needUsername: true }, { status: 400 });
  }

  let body: { amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const res = await placeBid(id, { email, name: `@${profile.username}` }, Number(body.amount) || 0);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }

  const viewerHash = hashEmail(email);
  const fresh = await getAuction(id);
  return NextResponse.json({ ok: true, auction: fresh ? toPublic(fresh, viewerHash) : null });
}

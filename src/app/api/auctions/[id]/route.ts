import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAuction, toPublic, hashEmail, auctionsConfigured } from "@/lib/auctions-blob";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!auctionsConfigured()) {
    return NextResponse.json({ configured: false, auction: null });
  }
  const { id } = await params;
  const session = await auth();
  const viewerHash = session?.user?.email ? hashEmail(session.user.email) : null;

  const a = await getAuction(id);
  if (!a) return NextResponse.json({ configured: true, auction: null }, { status: 404 });

  return NextResponse.json({
    configured: true,
    signedIn: !!session?.user,
    auction: toPublic(a, viewerHash),
  });
}

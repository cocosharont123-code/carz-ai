import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { addToGarage, getGarage, garageConfigured } from "@/lib/garage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ configured: garageConfigured(), signedIn: false, cars: [] });
  }
  const cars = await getGarage(session.user.email);
  return NextResponse.json({ configured: garageConfigured(), signedIn: true, cars });
}

export async function POST(req: Request) {
  if (!garageConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const res = await addToGarage(session.user.email, {
    image: typeof body.image === "string" ? body.image : "",
    make: typeof body.make === "string" ? body.make : "",
    model: typeof body.model === "string" ? body.model : "",
    yearRange: typeof body.yearRange === "string" ? body.yearRange : "",
    confidence: typeof body.confidence === "string" ? body.confidence : "",
    rarityScore: typeof body.rarityScore === "number" ? body.rarityScore : 0,
    priceRange: typeof body.priceRange === "string" ? body.priceRange : "",
  });
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}

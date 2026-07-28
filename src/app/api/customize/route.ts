import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { restyleCar, restyleConfigured } from "@/lib/restyle";
import { getRestyleUsage, recordRestyle, RESTYLE_DAILY_CAP } from "@/lib/restyle-usage";

export const runtime = "nodejs";
export const maxDuration = 60; // image editing can take 15–40s

export async function POST(req: Request) {
  // Signed-in users only, capped at RESTYLE_DAILY_CAP generations per day.
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, error: "Sign in to customize cars.", needSignIn: true }, { status: 401 });
  }

  if (!restyleConfigured()) {
    return NextResponse.json(
      { ok: false, error: "AI photo styling isn't set up yet (missing GEMINI_API_KEY)." },
      { status: 503 },
    );
  }

  const usage = await getRestyleUsage(email);
  if (usage.remaining <= 0) {
    return NextResponse.json(
      { ok: false, error: `You've used all ${RESTYLE_DAILY_CAP} customizations for today. Come back tomorrow.`, remaining: 0 },
      { status: 429 },
    );
  }

  let body: {
    image?: string;
    make?: string;
    model?: string;
    yearRange?: string;
    bodyColor?: string;
    rimColor?: string;
    features?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const dataUrl = body.image ?? "";
  if (!dataUrl.startsWith("data:")) {
    return NextResponse.json({ ok: false, error: "No source photo to restyle." }, { status: 400 });
  }
  const mediaType = dataUrl.slice(5, dataUrl.indexOf(";"));
  const base64Data = dataUrl.slice(dataUrl.indexOf(",") + 1);
  if (!mediaType || !base64Data) {
    return NextResponse.json({ ok: false, error: "Malformed image data." }, { status: 400 });
  }

  const features = Array.isArray(body.features) ? body.features.filter(Boolean).slice(0, 8) : [];
  if (!body.bodyColor && !body.rimColor && features.length === 0) {
    return NextResponse.json({ ok: false, error: "Pick at least one change first." }, { status: 400 });
  }

  try {
    const out = await restyleCar(mediaType, base64Data, {
      make: body.make,
      model: body.model,
      yearRange: body.yearRange,
      bodyColor: body.bodyColor,
      rimColor: body.rimColor,
      features,
    });
    // Charge a credit only on a successful generation.
    const remaining = await recordRestyle(email);
    return NextResponse.json({ ok: true, image: `data:${out.mediaType};base64,${out.base64}`, remaining });
  } catch (e) {
    console.error("customize failed:", e);
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Couldn't restyle the photo: ${detail}`, detail }, { status: 500 });
  }
}

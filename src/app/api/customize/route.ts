import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { restyleCar, restyleConfigured } from "@/lib/restyle";
import {
  getRestyleUsage,
  recordRestyle,
  RESTYLE_DAILY_CAP,
  RESTYLE_EXTRA_PRICE_USD,
} from "@/lib/restyle-usage";
import { getProfile, isActiveMember } from "@/lib/profile-blob";
import { recordConfig } from "@/lib/config-history";
import { bodyOption, rimOption, featureLabels } from "@/lib/customizer-options";

export const runtime = "nodejs";
export const maxDuration = 60; // image editing can take 15–40s

// Lightweight status check (no secrets) so the UI/ops can tell if the image
// model is configured without going through the signed-in generation flow.
// Also reports the caller's membership and quota, so the customizer can show
// the right gate before anyone spends a generation finding out.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({
      configured: restyleConfigured(),
      signedIn: false,
      member: false,
      cap: RESTYLE_DAILY_CAP,
      extraPriceUsd: RESTYLE_EXTRA_PRICE_USD,
    });
  }
  const member = isActiveMember(await getProfile(email));
  return NextResponse.json({
    configured: restyleConfigured(),
    signedIn: true,
    member,
    cap: RESTYLE_DAILY_CAP,
    extraPriceUsd: RESTYLE_EXTRA_PRICE_USD,
    quota: member ? await getRestyleUsage(email) : null,
  });
}

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

  // Carz+ only. Checked against the stored profile, not anything the client
  // sent, and re-checked on every generation so a lapsed membership stops
  // working immediately rather than at the next daily reset.
  if (!isActiveMember(await getProfile(email))) {
    return NextResponse.json(
      {
        ok: false,
        error: "The car customizer is a Carz+ feature.",
        needMembership: true,
      },
      { status: 402 },
    );
  }

  const quota = await getRestyleUsage(email);
  if (quota.available <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `You've used all ${RESTYLE_DAILY_CAP} customizations for today.`,
        quota,
        canBuyExtra: true,
        extraPriceUsd: RESTYLE_EXTRA_PRICE_USD,
      },
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
    // Charge only on a successful generation — a failed render costs nothing.
    const spent = await recordRestyle(email);

    // Log the config to the member's history. Best-effort: a storage hiccup
    // must not lose the render the user just spent a credit on.
    let historyId: string | null = null;
    try {
      const body_ = bodyOption(body.bodyColor);
      const rim = rimOption(body.rimColor);
      const entry = await recordConfig(email, {
        make: body.make ?? "",
        model: body.model ?? "",
        yearRange: body.yearRange ?? "",
        bodyColor: body_?.label,
        bodyHex: body_?.hex,
        rimColor: rim?.label,
        rimHex: rim?.hex,
        features: featureLabels(features),
      });
      historyId = entry?.id ?? null;
    } catch (e) {
      console.error("config history write failed:", e);
    }

    return NextResponse.json({
      ok: true,
      image: `data:${out.mediaType};base64,${out.base64}`,
      quota: spent,
      // Kept for older clients that read a bare number.
      remaining: spent.available,
      historyId,
    });
  } catch (e) {
    console.error("customize failed:", e);
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: `Couldn't restyle the photo: ${detail}`, detail }, { status: 500 });
  }
}

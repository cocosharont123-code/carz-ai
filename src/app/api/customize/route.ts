import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { restyleCar, restyleConfigured } from "@/lib/restyle";
import {
  getRestyleUsage,
  recordRestyle,
  RESTYLE_DAILY_CAP,
  RESTYLE_EXTRA_PRICE_USD,
} from "@/lib/restyle-usage";
import { getProfile, isActiveMember, isMaxMember } from "@/lib/profile-blob";
import { watermark } from "@/lib/watermark";
import { recordConfig } from "@/lib/config-history";
import { rimOption } from "@/lib/customizer-options";

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
  // Read once: the same profile decides whether they may generate at all and
  // whether the result carries a watermark.
  const profile = await getProfile(email);
  if (!isActiveMember(profile)) {
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
    bodyLabel?: string;
    bodyHex?: string;
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
    // Carz MAX renders come out clean; every other tier is stamped. Done here
    // rather than in the page because the file is what gets saved and shared,
    // and an overlay in the DOM is not on the file.
    let picture = { base64: out.base64, mediaType: out.mediaType };
    if (!isMaxMember(profile)) {
      try {
        picture = await watermark(out.base64, out.mediaType);
      } catch (e) {
        // Hand over the render they just paid a credit for rather than failing
        // on the stamp. Loud in the log, because an unmarked render is the
        // paywall quietly not working.
        console.error("watermark failed, returning unmarked render:", e);
      }
    }

    // Charge only on a successful generation — a failed render costs nothing.
    const spent = await recordRestyle(email);

    // Log the config to the member's history. Best-effort: a storage hiccup
    // must not lose the render the user just spent a credit on.
    let historyId: string | null = null;
    try {
      // The colour is whatever the wheel produced, so its label and hex come
      // from the client rather than a lookup. Both are bounded here: they are
      // written to stored history and read back into the UI.
      const rim = rimOption(body.rimColor);
      const bodyLabel = typeof body.bodyLabel === "string" ? body.bodyLabel.slice(0, 40) : undefined;
      const bodyHex = /^#[0-9a-fA-F]{6}$/.test(body.bodyHex ?? "") ? body.bodyHex : undefined;
      const entry = await recordConfig(email, {
        make: body.make ?? "",
        model: body.model ?? "",
        yearRange: body.yearRange ?? "",
        bodyColor: bodyLabel,
        bodyHex,
        rimColor: rim?.label,
        rimHex: rim?.hex,
        features: features,
      });
      historyId = entry?.id ?? null;
    } catch (e) {
      console.error("config history write failed:", e);
    }

    return NextResponse.json({
      ok: true,
      image: `data:${picture.mediaType};base64,${picture.base64}`,
      watermarked: !isMaxMember(profile),
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

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getUserId,
  getUser,
  planStatusFor,
  atLimitFor,
  recordIdentification,
  UID_COOKIE,
  PLAN_COOKIE,
  isPlanId,
} from "@/lib/store";
import { PLANS } from "@/lib/plans";
import { readVin, decodeVinToCar, IdentifyError, type VinRead } from "@/lib/identify";
import { lookupVinNhtsa } from "@/lib/vin-nhtsa";
import { decodeVin, repairVin, hasVinShape, type VinFacts } from "@/lib/vin";
import { auth } from "@/auth";
import { getProfile, isActiveMember } from "@/lib/profile-blob";

export const runtime = "nodejs";
// A VIN read is at most two vision passes plus a registry lookup and a decode —
// shorter than a contested photo scan, but the same order of magnitude, and a
// crop of an unreadable plate is exactly the case that runs long.
export const maxDuration = 180;

/**
 * Identify a car from its VIN — photographed, or typed if the plate won't
 * photograph. Deliberately the same shape of answer as /api/identify: the
 * client renders one result view and asks /api/identify/details for the spec
 * sheet either way.
 *
 * The order matters. The characters are read and arithmetically verified first,
 * then the registry is asked what they mean, and only then does the model fill
 * what neither could answer. Every step that can be checked is checked before
 * anything is inferred.
 */
export async function POST(req: Request) {
  const { id, isNew } = await getUserId();
  const jar = await cookies();
  if (isNew) {
    jar.set(UID_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }

  let body: { image?: string; vin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const typed = (body.vin ?? "").trim();
  const dataUrl = body.image ?? "";
  if (!typed && !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "Send a photo of the VIN, or the VIN itself." }, { status: 400 });
  }

  const user = getUser(id);
  const cookiePlan = jar.get(PLAN_COOKIE)?.value;
  const effectivePlan = isPlanId(cookiePlan) ? cookiePlan : user.plan;
  const plan = PLANS[effectivePlan] ?? PLANS.free;

  const session = await auth();
  let isMember = false;
  if (session?.user?.email) {
    const profile = await getProfile(session.user.email);
    isMember = isActiveMember(profile);
  }

  // A VIN scan costs the same daily allowance as a photo scan. It's the same
  // pipeline behind it, and leaving it unmetered would make the limit on /spot
  // meaningless the moment anyone noticed.
  if (!isMember && atLimitFor(effectivePlan, user)) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message: `You've used all ${plan.dailyLimit} free scans today. Get Carz+ for unlimited.`,
        status: planStatusFor(effectivePlan, user),
      },
      { status: 402 },
    );
  }

  try {
    // 1. Get the characters — off the photo, or straight from the keyboard.
    let read: VinRead;
    if (typed) {
      const facts = decodeVin(typed);
      read = {
        found: true,
        vin: facts.vin,
        surface: "typed in",
        legibility: "high",
        notes: "",
        verified: facts.checkDigitOk,
      };
    } else {
      const comma = dataUrl.indexOf(",");
      const mediaType = dataUrl.slice(5, dataUrl.indexOf(";"));
      const base64Data = dataUrl.slice(comma + 1);
      if (!mediaType || !base64Data) {
        return NextResponse.json({ error: "Malformed image data." }, { status: 400 });
      }
      read = await readVin(mediaType, base64Data);
    }

    if (!read.vin) {
      return NextResponse.json({
        ok: false,
        reason: "not_found",
        message:
          "No VIN in that photo. It's on a small plate at the base of the windscreen on the driver's side, on the sticker inside the driver's door jamb, or on the registration papers.",
        read,
      });
    }

    // 2. Verify, and repair a single misread character where the checksum can
    //    prove which one it was.
    let vin = read.vin;
    let corrected = "";
    let ambiguous: string[] = [];
    if (!read.verified && hasVinShape(vin)) {
      const { fixed, candidates } = repairVin(vin);
      if (fixed) {
        corrected = vin;
        vin = fixed;
      } else if (candidates.length > 1) {
        ambiguous = candidates.slice(0, 4);
      }
    }

    const facts: VinFacts = decodeVin(vin);

    // A VIN that isn't 17 valid characters can't be decoded, and guessing at a
    // partial one would be worse than saying so.
    if (!facts.wellFormed) {
      return NextResponse.json({
        ok: false,
        reason: "unreadable",
        message:
          vin.length === 17
            ? "That doesn't look like a valid VIN. Try a straighter, closer photo of the plate."
            : `Only read ${vin.length} of the 17 characters. Get closer to the plate, or type the VIN in instead.`,
        vin,
        facts,
        read,
      });
    }

    // 3. Ask the registry, then have the model fill what it didn't cover. The
    //    lookup is best-effort: outside the US market vPIC simply has no record.
    const registry = await lookupVinNhtsa(vin);
    const car = await decodeVinToCar({
      vin,
      manufacturer: facts.manufacturer,
      country: facts.country,
      modelYear: facts.modelYear,
      registry: registry?.resolved ? registry : null,
    });

    // The registry knows the drivetrain and engine outright; the spec pass that
    // follows on the client would otherwise be estimating them from the model name.
    if (registry?.resolved) {
      if (registry.driveType) car.drivetrain = registry.driveType;
      if (registry.engine) car.engine = registry.engine;
      if (registry.plantCountry) car.countryOfOrigin = registry.plantCountry;
    }

    const status = recordIdentification(
      id,
      { make: car.make, model: car.model, yearRange: car.yearRange, isCar: car.isCar },
      effectivePlan,
    );

    return NextResponse.json({
      ok: true,
      vin,
      corrected,
      ambiguous,
      facts,
      read,
      registrySource: registry?.resolved ? "NHTSA vPIC" : "",
      car,
      status,
      premium: plan.premiumReport,
    });
  } catch (e) {
    const message = e instanceof IdentifyError ? e.message : "Couldn't read that VIN.";
    return NextResponse.json({ error: "vin_failed", message }, { status: 502 });
  }
}

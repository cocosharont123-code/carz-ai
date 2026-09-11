import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getUserId,
  getUser,
  planStatusFor,
  usageToday,
  recordIdentification,
  UID_COOKIE,
  PLAN_COOKIE,
  isPlanId,
} from "@/lib/store";
import { PLANS, DAILY_SCANS } from "@/lib/plans";
import { identifyCar, IdentifyError } from "@/lib/identify";
import { auth } from "@/auth";
import { getProfile, memberTier } from "@/lib/profile-blob";
import { SCAN_MODE_COOKIE, effectiveScanMode } from "@/lib/scan-mode";

export const runtime = "nodejs";
// A confident scan is two concurrent looks and returns quickly. A contested one
// can chain a zoom, an adjudication and a regenerated report on top of that, and
// each of those now runs at high effort — 60s was tight enough that the hardest
// cars, the ones the extra passes exist for, would have timed out instead.
export const maxDuration = 300;

export async function POST(req: Request) {
  const { id, isNew } = await getUserId();
  const jar = await cookies();
  if (isNew) {
    jar.set(UID_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  const cookiePlan = jar.get(PLAN_COOKIE)?.value;

  let body: { image?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const dataUrl = body.image ?? "";
  if (!dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "Expected a data: image URL." }, { status: 400 });
  }
  const comma = dataUrl.indexOf(",");
  const mediaType = dataUrl.slice(5, dataUrl.indexOf(";"));
  const base64Data = dataUrl.slice(comma + 1);
  if (!mediaType || !base64Data) {
    return NextResponse.json({ error: "Malformed image data." }, { status: 400 });
  }

  const user = getUser(id);
  const effectivePlan = isPlanId(cookiePlan) ? cookiePlan : user.plan;
  const plan = PLANS[effectivePlan] ?? PLANS.free;

  // Three ceilings, one per tier: free three a day, Carz+ eight, MAX none.
  const session = await auth();
  const profile = session?.user?.email ? await getProfile(session.user.email) : null;
  const tier = memberTier(profile);
  const isMember = tier !== null;

  const cap = tier === "max" ? DAILY_SCANS.max : tier === "plus" ? DAILY_SCANS.plus : DAILY_SCANS.free;
  const usedToday = usageToday(user);

  if (cap !== null && usedToday >= cap) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message:
          tier === "plus"
            ? `You've used all ${cap} scans today. Carz MAX has no daily cap.`
            : `You've used all ${cap} free scans today. Carz+ gives you ${DAILY_SCANS.plus} a day.`,
        tier,
        status: planStatusFor(effectivePlan, user),
      },
      { status: 402 },
    );
  }

  try {
    // Identification only — the spec sheet, rarity and values follow from the
    // car's name, not the photo, and are fetched separately so the spotter sees
    // their answer without waiting on them.
    // Read from the cookie, not the request body: the body is the client's to
    // set, and Precise is a paid pipeline. `effectiveScanMode` also downgrades a
    // cookie left over from a lapsed membership.
    const scanMode = effectiveScanMode(jar.get(SCAN_MODE_COOKIE)?.value, isMember);
    const car = await identifyCar(mediaType, base64Data, body.note, scanMode);
    const status = recordIdentification(
      id,
      { make: car.make, model: car.model, yearRange: car.yearRange, isCar: car.isCar },
      effectivePlan,
    );
    return NextResponse.json({ car, status, premium: plan.premiumReport, scanMode });
  } catch (e) {
    const message = e instanceof IdentifyError ? e.message : "Identification failed.";
    return NextResponse.json({ error: "identify_failed", message }, { status: 502 });
  }
}

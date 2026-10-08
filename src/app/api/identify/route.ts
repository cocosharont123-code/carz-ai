import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getUserId,
  getUser,
  planStatusFor,
  recordIdentification,
  UID_COOKIE,
  PLAN_COOKIE,
  isPlanId,
} from "@/lib/store";
import { PLANS, DAILY_SCANS } from "@/lib/plans";
import { identifyCar, IdentifyError } from "@/lib/identify";
import { auth } from "@/auth";
import { getProfile, memberTier } from "@/lib/profile-blob";
import { takeAiCall } from "@/lib/ai-rate-limit";
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

  // Three ceilings, one per tier: free three a day, Carz PRO eight, MAX none.
  const session = await auth();
  const profile = session?.user?.email ? await getProfile(session.user.email) : null;
  const tier = memberTier(profile);
  const isMember = tier !== null;

  const cap = tier === "max" ? DAILY_SCANS.max : tier === "plus" ? DAILY_SCANS.plus : DAILY_SCANS.free;

  /**
   * The cap, counted somewhere that survives a cold start.
   *
   * It used to be usageToday(user) out of lib/store.ts -- an in-memory object
   * backed by a file in /tmp, which on Vercel is per serverless instance. A new
   * container was a fresh counter, so the cap was not leaky, it was absent. The
   * id it counted against was UID_COOKIE as well, which anyone can clear.
   *
   * takeAiCall counts against the signed-in email in Blob, and checks a burst
   * window as well as the day: eight a day still allows eight vision calls in
   * the same second, and what runs a bill up is not a person pressing a button.
   */
  const email = session?.user?.email;
  if (!email) {
    // Every route is behind the sign-in wall, so this is a belt-and-braces
    // check rather than a path anyone reaches -- but the limit is keyed on the
    // account, and an unkeyed expensive call is the hole being closed.
    return NextResponse.json({ error: "Sign in to scan." }, { status: 401 });
  }

  const gate = await takeAiCall("identify", email, cap);
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: gate.reason === "burst" ? "too_fast" : "limit_reached",
        message:
          gate.reason === "burst"
            ? "That's a lot of scans at once — give it a few seconds."
            : tier === "plus"
              ? `You've used all ${cap} scans today. Carz MAX has no daily cap.`
              // Points at Carz PRO only while Carz PRO is actually more scans.
              // With the PRO cap at 2 and free at 3, the old line read "you've
              // used all 3 free scans, Carz PRO gives you 2 a day", which is an
              // argument against buying it. MAX is the honest upsell when PRO
              // is not an upgrade on this axis.
              : DAILY_SCANS.plus > DAILY_SCANS.free
                ? `You've used all ${cap} free scans today. Carz PRO gives you ${DAILY_SCANS.plus} a day.`
                : `You've used all ${cap} free scans today. Carz MAX has no daily cap.`,
        tier,
        status: planStatusFor(effectivePlan, user),
      },
      {
        // 429 for a burst, 402 for the day: one says wait, the other says pay,
        // and a client that cannot tell them apart shows the wrong screen.
        status: gate.reason === "burst" ? 429 : 402,
        headers: { "Retry-After": String(gate.retryAfter) },
      },
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

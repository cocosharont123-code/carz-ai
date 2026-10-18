import { NextResponse } from "next/server";
import { getUserId, getUser, isPlanId, planStatusFor, PLAN_COOKIE } from "@/lib/store";
import { cookies } from "next/headers";
import { PLANS } from "@/lib/plans";
import { describeCar, IdentifyError } from "@/lib/identify";
import { auth } from "@/auth";
import { getProfile, isMaxMember } from "@/lib/profile-blob";

export const runtime = "nodejs";

/**
 * The country the request came from, for the "how many are in your country"
 * figure.
 *
 * Vercel puts the geo-IP country on every request; locally and anywhere else
 * the header is absent and the figure is simply skipped. No extra service, no
 * permission prompt, and nothing stored — it is read off the request and used
 * for the length of it.
 */
function viewerCountry(req: Request): string | undefined {
  const code = req.headers.get("x-vercel-ip-country")?.trim();
  if (!code || code.length !== 2) return undefined;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? undefined;
  } catch {
    return undefined;
  }
}
export const maxDuration = 120;

// The half of a car report that doesn't need the photo. /api/identify returns
// the identification as soon as it's settled; the client asks for this straight
// after, so the spec sheet, rarity and values fill in behind an answer that is
// already on screen. Scans were already counted by /api/identify, so this only
// echoes the current plan status back alongside the specs.
export async function POST(req: Request) {
  const { id } = await getUserId();
  const jar = await cookies();
  const cookiePlan = jar.get(PLAN_COOKIE)?.value;

  let b: {
    make?: string;
    model?: string;
    yearRange?: string;
    generation?: string;
    trimGuess?: string;
  };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const make = (b.make || "").trim();
  const model = (b.model || "").trim();
  if (!make && !model) {
    return NextResponse.json({ error: "Nothing to describe." }, { status: 400 });
  }

  const user = getUser(id);
  const effectivePlan = isPlanId(cookiePlan) ? cookiePlan : user.plan;
  const plan = PLANS[effectivePlan] ?? PLANS.free;

  // Market-value insight is the MAX tier's, so Carz PRO does not get it either —
  // decided by membership here rather than by the plan record, which is the
  // same for everyone.
  const session = await auth();
  let isMax = false;
  if (session?.user?.email) {
    isMax = isMaxMember(await getProfile(session.user.email));
  }

  try {
    const specs = await describeCar(
      {
        make,
        model,
        yearRange: (b.yearRange || "").trim(),
        generation: (b.generation || "").trim(),
        trimGuess: (b.trimGuess || "").trim(),
      },
      plan.premiumReport && isMax,
      viewerCountry(req),
    );

    const status = planStatusFor(effectivePlan, user);

    return NextResponse.json({ specs, status });
  } catch (e) {
    const message = e instanceof IdentifyError ? e.message : "Couldn't load the details.";
    return NextResponse.json({ error: "details_failed", message }, { status: 502 });
  }
}

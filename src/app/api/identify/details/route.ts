import { NextResponse } from "next/server";
import { getUserId, getUser, isPlanId, recordGoals, PLAN_COOKIE } from "@/lib/store";
import { cookies } from "next/headers";
import { PLANS } from "@/lib/plans";
import { describeCar, IdentifyError, type CarReport } from "@/lib/identify";
import { goalsForDate, evaluateGoals } from "@/lib/gamification";

export const runtime = "nodejs";
export const maxDuration = 120;

// The half of a car report that doesn't need the photo. /api/identify returns
// the identification as soon as it's settled; the client asks for this straight
// after, so the spec sheet, rarity and values fill in behind an answer that is
// already on screen. Scans were already counted by /api/identify — this only
// credits goals, which are judged on the numbers that arrive here.
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

  try {
    const specs = await describeCar(
      {
        make,
        model,
        yearRange: (b.yearRange || "").trim(),
        generation: (b.generation || "").trim(),
        trimGuess: (b.trimGuess || "").trim(),
      },
      plan.premiumReport,
    );

    // Goals check engine, power, rarity, top speed and value — all of which only
    // exist now, which is why they're credited here rather than on the scan.
    const today = new Date().toISOString().slice(0, 10);
    const completedGoals = evaluateGoals(
      { ...specs, isCar: true } as CarReport,
      goalsForDate(today),
    );
    const status = recordGoals(id, completedGoals, effectivePlan);

    return NextResponse.json({ specs, status, completedGoals });
  } catch (e) {
    const message = e instanceof IdentifyError ? e.message : "Couldn't load the details.";
    return NextResponse.json({ error: "details_failed", message }, { status: 502 });
  }
}

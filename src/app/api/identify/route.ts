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
import { identifyCar, IdentifyError } from "@/lib/identify";
import { goalsForDate, evaluateGoals } from "@/lib/gamification";
import { auth } from "@/auth";
import { recordSpot } from "@/lib/leaderboard";
import { signPostToken } from "@/lib/posttoken";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  if (atLimitFor(effectivePlan, user)) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message: `You've hit your daily limit of ${plan.dailyLimit} on the ${plan.name} plan.`,
        status: planStatusFor(effectivePlan, user),
      },
      { status: 402 },
    );
  }

  try {
    const car = await identifyCar(mediaType, base64Data, plan.premiumReport, body.note);
    const today = new Date().toISOString().slice(0, 10);
    const completedGoals = car.isCar ? evaluateGoals(car, goalsForDate(today)) : [];
    const status = recordIdentification(
      id,
      { make: car.make, model: car.model, yearRange: car.yearRange, isCar: car.isCar },
      completedGoals,
      effectivePlan,
    );
    // Record to the global leaderboard for signed-in users.
    const session = await auth();
    if (session?.user?.email) {
      await recordSpot(
        { id: session.user.email, name: session.user.name, image: session.user.image },
        car,
      );
    }
    const postToken = car.isCar ? signPostToken(car.make, car.model) : null;
    return NextResponse.json({ car, status, completedGoals, postToken });
  } catch (e) {
    const message = e instanceof IdentifyError ? e.message : "Identification failed.";
    return NextResponse.json({ error: "identify_failed", message }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, getUser, planStatus, atLimit, recordIdentification, UID_COOKIE } from "@/lib/store";
import { PLANS } from "@/lib/plans";
import { identifyCar, IdentifyError } from "@/lib/identify";
import { goalsForDate, evaluateGoals } from "@/lib/gamification";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { id, isNew } = await getUserId();
  if (isNew) {
    const jar = await cookies();
    jar.set(UID_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }

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
  const plan = PLANS[user.plan] ?? PLANS.free;

  if (atLimit(user)) {
    return NextResponse.json(
      {
        error: "limit_reached",
        message: `You've hit your daily limit of ${plan.dailyLimit} on the ${plan.name} plan.`,
        status: planStatus(user),
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
    );
    return NextResponse.json({ car, status, completedGoals });
  } catch (e) {
    const message = e instanceof IdentifyError ? e.message : "Identification failed.";
    return NextResponse.json({ error: "identify_failed", message }, { status: 502 });
  }
}

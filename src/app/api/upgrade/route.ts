import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, setPlan, UID_COOKIE, PLAN_COOKIE } from "@/lib/store";
import { PLANS, type PlanId } from "@/lib/plans";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 365, path: "/" };

export const runtime = "nodejs";

/**
 * Demo upgrade endpoint. In production this would create a Stripe Checkout
 * session and only flip the plan after a verified webhook (see README).
 */
export async function POST(req: Request) {
  const { id, isNew } = await getUserId();
  const jar = await cookies();
  if (isNew) jar.set(UID_COOKIE, id, COOKIE_OPTS);

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const plan = body.plan as PlanId;
  if (!plan || !(plan in PLANS)) {
    return NextResponse.json({ error: "unknown plan" }, { status: 400 });
  }

  const status = setPlan(id, plan);
  jar.set(PLAN_COOKIE, plan, COOKIE_OPTS); // persist plan across serverless instances
  return NextResponse.json({ ok: true, status });
}

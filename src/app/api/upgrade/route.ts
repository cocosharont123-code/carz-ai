import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, setPlan, UID_COOKIE } from "@/lib/store";
import { PLANS, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";

/**
 * Demo upgrade endpoint. In production this would create a Stripe Checkout
 * session and only flip the plan after a verified webhook (see README).
 */
export async function POST(req: Request) {
  const { id, isNew } = await getUserId();
  if (isNew) {
    const jar = await cookies();
    jar.set(UID_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }

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
  return NextResponse.json({ ok: true, status });
}

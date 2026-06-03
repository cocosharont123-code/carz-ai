import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, setPlan, UID_COOKIE, PLAN_COOKIE } from "@/lib/store";
import { planForCode } from "@/lib/promo";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";

const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 365, path: "/" };

export async function POST(req: Request) {
  const { id, isNew } = await getUserId();
  const jar = await cookies();
  if (isNew) jar.set(UID_COOKIE, id, COOKIE_OPTS);

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const plan = planForCode(body.code || "");
  if (!plan) {
    return NextResponse.json({ ok: false, error: "That promo code isn't valid." }, { status: 400 });
  }

  const status = setPlan(id, plan);
  jar.set(PLAN_COOKIE, plan, COOKIE_OPTS); // persist plan across serverless instances
  return NextResponse.json({
    ok: true,
    plan,
    planName: PLANS[plan].name,
    status,
  });
}

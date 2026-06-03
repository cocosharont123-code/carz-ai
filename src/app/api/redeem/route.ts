import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserId, setPlan, UID_COOKIE } from "@/lib/store";
import { planForCode } from "@/lib/promo";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { id, isNew } = await getUserId();
  if (isNew) {
    const jar = await cookies();
    jar.set(UID_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }

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
  return NextResponse.json({
    ok: true,
    plan,
    planName: PLANS[plan].name,
    status,
  });
}

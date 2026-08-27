import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getProfile, isActiveMember } from "@/lib/profile-blob";
import { grantRestyleCredits, RESTYLE_EXTRA_PRICE_USD } from "@/lib/restyle-usage";

export const runtime = "nodejs";

/**
 * Buy one extra customization once the daily three are spent.
 *
 * ⚠️ NO PAYMENT IS TAKEN. There is no payment provider wired into this app —
 * the same is true of Carz+ membership and the $0.99 streak restore, which are
 * both stubbed the same way. This endpoint grants the credit and reports
 * `charged: false` so the UI can say so plainly rather than implying a card was
 * billed. Wire Stripe (or the App Store IAP) in here before treating this as
 * revenue: the charge must succeed *before* grantRestyleCredits is called.
 */
export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "Sign in first.", needSignIn: true },
      { status: 401 },
    );
  }

  // Extras top up a Carz+ allowance, so they're members-only too — otherwise
  // 50 cents would buy a way around the membership gate entirely.
  if (!isActiveMember(await getProfile(email))) {
    return NextResponse.json(
      { ok: false, error: "The car customizer is a Carz+ feature.", needMembership: true },
      { status: 402 },
    );
  }

  const quota = await grantRestyleCredits(email, 1);

  return NextResponse.json({
    ok: true,
    quota,
    priceUsd: RESTYLE_EXTRA_PRICE_USD,
    // The UI shows this to the user. Do not flip it to true until a real
    // charge actually happens above.
    charged: false,
  });
}

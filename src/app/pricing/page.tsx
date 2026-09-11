"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { X } from "lucide-react";
import PricingSection, { type PricingTier } from "@/components/ui/pricing-section-1";
import { CARZ_PLUS, CARZ_MAX, annualSaving } from "@/lib/plans";
import { applyDiscount, lookupPromo, type Promo } from "@/lib/promos";

type TierId = "plus" | "max";

/**
 * Both tiers, on one page, billed either way.
 *
 * The page owns everything that decides what is charged — the interval, the
 * promo, which tier — and hands the section finished numbers. The section
 * renders; it never computes a price.
 */
export default function PricingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [busy, setBusy] = useState<TierId | null>(null);
  const [annual, setAnnual] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [joinError, setJoinError] = useState("");
  // Null until the membership check lands, so an existing member never sees a
  // join CTA flash before it resolves.
  const [member, setMember] = useState<boolean | null>(null);
  const [tier, setTier] = useState<TierId | null>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    fetch("/api/membership", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setMember(!!d.member);
        if (d.tier === "max" || d.tier === "plus") setTier(d.tier);
        if (d.billing) setBilling(d.billing);
        if (d.billing === "annual") setAnnual(true);
      })
      .catch(() => setMember(false));
  }, [status]);

  function post(body: Record<string, unknown>) {
    return fetch("/api/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }

  function applyPromo() {
    const found = lookupPromo(promoInput);
    if (!found) {
      setPromo(null);
      setPromoError("That promo code isn't valid.");
      return;
    }
    setPromo(found);
    setPromoError("");
  }

  function removePromo() {
    setPromo(null);
    setPromoInput("");
    setPromoError("");
  }

  const isFree = promo?.percentOff === 100;

  /** List price for a tier at the current interval, before any discount. */
  const listPrice = (id: TierId) => {
    const plan = id === "max" ? CARZ_MAX : CARZ_PLUS;
    return annual ? plan.annual : plan.monthly;
  };

  const finalPrice = (id: TierId) => {
    const base = listPrice(id);
    return promo ? applyDiscount(base, promo.percentOff) : base;
  };

  async function join(id: TierId) {
    if (busy) return;
    if (member) return; // A member has no button to press.
    if (status !== "authenticated") {
      signIn("google", { callbackUrl: "/pricing" });
      return;
    }
    setBusy(id);
    setJoinError("");
    try {
      let d;
      if (isFree) {
        // A 100%-off code unlocks the chosen tier outright.
        d = await post({ action: "redeem", code: promo!.code, tier: id });
      } else if (annual) {
        d = await post({ action: "join", interval: "annual", code: promo?.code, tier: id });
      } else if (id === "plus") {
        // The trial is a Carz+ monthly path only: startTrial grants no tier, so
        // routing MAX through it would sell the cheaper membership.
        d = await post({ action: "trial" });
        if (!d?.ok && !d?.needUsername) {
          d = await post({ action: "join", interval: "monthly", code: promo?.code, tier: id });
        }
      } else {
        d = await post({ action: "join", interval: "monthly", code: promo?.code, tier: id });
      }

      if (d?.needUsername) {
        router.push("/profile?next=/pricing");
        return;
      }
      if (!d?.ok) {
        setJoinError(d?.error || "Couldn't start your membership. Try again.");
        return;
      }
      setMember(true);
      setTier(d.tier === "max" ? "max" : "plus");
      setBilling(annual ? "annual" : "monthly");
    } catch {
      setJoinError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  }

  /** What the button on a tier says, or nothing at all once it is held. */
  function cta(id: TierId): string | undefined {
    if (member) return undefined;
    if (busy === id) return "Starting…";
    const name = id === "max" ? CARZ_MAX.name : CARZ_PLUS.name;
    if (isFree) return `Redeem ${name} free`;
    if (id === "plus" && !annual && !promo) return "Start free trial";
    return `Get ${name}`;
  }

  function note(id: TierId): string | undefined {
    if (member) return tier === id ? "Your current plan" : undefined;
    if (isFree) return undefined;
    if (id === "plus" && !annual && !promo) {
      return `7 days free, then $${CARZ_PLUS.monthly.toFixed(2)}/mo`;
    }
    if (annual) {
      const plan = id === "max" ? CARZ_MAX : CARZ_PLUS;
      return `Save ${annualSaving(plan.monthly, plan.annual)}% against monthly`;
    }
    return undefined;
  }

  const tiers: PricingTier[] = [
    {
      id: "plus",
      name: CARZ_PLUS.name,
      blurb: CARZ_PLUS.blurb,
      price: finalPrice("plus"),
      wasPrice: promo ? listPrice("plus") : undefined,
      interval: annual ? "yr" : "mo",
      perks: CARZ_PLUS.perks,
      featured: !member || tier === "plus",
      badge: member && tier === "plus" ? "Active" : undefined,
      cta: cta("plus"),
      onSelect: () => void join("plus"),
      note: note("plus"),
    },
    {
      id: "max",
      name: CARZ_MAX.name,
      blurb: CARZ_MAX.blurb,
      price: finalPrice("max"),
      wasPrice: promo ? listPrice("max") : undefined,
      interval: annual ? "yr" : "mo",
      perksLead: `Everything in ${CARZ_PLUS.name}, plus:`,
      perks: CARZ_MAX.perks,
      featured: member ? tier === "max" : false,
      badge: member && tier === "max" ? "Active" : undefined,
      cta: cta("max"),
      onSelect: () => void join("max"),
      note: note("max"),
    },
  ];

  const activeName = tier === "max" ? CARZ_MAX.name : CARZ_PLUS.name;

  return (
    <PricingSection
      eyebrow={member ? "Membership" : "Carz membership"}
      title={member ? "You're in" : "Choose your plan"}
      subtitle={
        member
          ? `${activeName} is active on your account, billed ${billing === "annual" ? "yearly" : "monthly"}.`
          : "Spot more cars, keep a garage, and ask CarzBot anything. Cancel whenever."
      }
      tiers={tiers}
      // A member's interval is already settled, so there is nothing to switch.
      billing={member ? undefined : { value: annual ? "1" : "0", monthlyLabel: "Monthly", annualLabel: "Yearly" }}
      onBillingSwitch={(v) => setAnnual(v === "1")}
      busy={busy !== null}
    >
      {!member && (
        <div className="mx-auto mt-7 max-w-sm">
          {promo ? (
            <div className="glass-card flex min-h-11 items-center justify-between gap-3 rounded-full px-4 py-2">
              <p className="text-sm">
                <span className="font-bold">{promo.code.toUpperCase()}</span>
                <span className="opacity-70">
                  {" "}
                  applied — {promo.percentOff}% off
                </span>
              </p>
              <button
                type="button"
                onClick={removePromo}
                aria-label={`Remove promo code ${promo.code.toUpperCase()}`}
                className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carz/60"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <label htmlFor="promo" className="sr-only">
                Promo code
              </label>
              <input
                id="promo"
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value);
                  setPromoError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                placeholder="Promo code"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="glass-card min-h-11 flex-1 rounded-full bg-transparent px-4 text-sm outline-none placeholder:opacity-40 focus-visible:ring-2 focus-visible:ring-carz/60"
              />
              <button
                type="button"
                onClick={applyPromo}
                className="press glass-card min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carz/60"
              >
                Apply
              </button>
            </div>
          )}

          {/* Errors are text, not a red border alone. */}
          {promoError && (
            <p role="alert" className="mt-2 text-center text-sm text-neon-red">
              {promoError}
            </p>
          )}
          {joinError && (
            <p role="alert" className="mt-2 text-center text-sm text-neon-red">
              {joinError}
            </p>
          )}
        </div>
      )}
    </PricingSection>
  );
}

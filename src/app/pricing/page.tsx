"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ModernPricingPage, type PricingCardProps } from "@/components/ui/animated-glassy-pricing";
import { cn } from "@/lib/utils";
import { applyDiscount, formatPrice, lookupPromo, type Promo } from "@/lib/promos";

export default function PricingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [busy, setBusy] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoError, setPromoError] = useState("");
  const [joinError, setJoinError] = useState("");
  // Null until the membership check lands, so an existing member never sees a
  // join CTA flash before it resolves.
  const [member, setMember] = useState<boolean | null>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    fetch("/api/membership", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setMember(!!d.member);
        if (d.billing) setBilling(d.billing);
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

  const basePrice = annual ? 80 : 9.99;
  const finalPrice = promo ? applyDiscount(basePrice, promo.percentOff) : basePrice;
  const priceStr = formatPrice(finalPrice);
  const isFree = promo?.percentOff === 100;

  async function joinCarzPlus() {
    if (busy) return;
    // Already subscribed — go straight to the rewards, never re-run the join.
    if (member) {
      router.push("/membership");
      return;
    }
    if (status !== "authenticated") {
      signIn("google", { callbackUrl: "/pricing" });
      return;
    }
    setBusy(true);
    try {
      let d;
      if (isFree) {
        // 100%-off code unlocks Carz+ outright.
        d = await post({ action: "redeem", code: promo!.code });
      } else if (annual) {
        // Annual is a direct purchase (at the promo rate, if any).
        d = await post({ action: "join", interval: "annual", code: promo?.code });
      } else {
        // Monthly starts the free trial; fall back to joining if already used.
        d = await post({ action: "trial" });
        if (!d?.ok && !d?.needUsername) d = await post({ action: "join", interval: "monthly", code: promo?.code });
      }
      if (d?.needUsername) {
        router.push("/profile?next=/pricing");
        return;
      }
      if (!d?.ok) {
        setJoinError(d?.error || "Couldn't start your membership. Try again.");
        return;
      }
      // Subscribed — the member area now opens straight onto the rewards.
      setMember(true);
      router.push("/membership");
    } catch {
      setJoinError("Couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const carzButtonText = member
    ? "See your rewards"
    : busy
      ? "Starting…"
      : isFree
        ? "Redeem — Carz+ free"
        : promo
          ? `Get Carz+ · $${priceStr}${annual ? "/yr" : "/mo"}`
          : annual
            ? "Get annual · $80/yr"
            : "Start free trial";

  const plans: PricingCardProps[] = [
    {
      planName: "Free",
      description: "Get started spotting and bidding.",
      price: "0",
      features: ["3 car scans per day", "Spotting map", "Bid on auctions", "Live leaderboard", "Car Hunt events"],
      buttonText: "Start spotting",
      buttonVariant: "secondary",
      onSelect: () => router.push("/spot"),
    },
    {
      planName: "Carz+",
      description: member ? "You're a member — here's everything you unlocked." : "The membership for serious spotters.",
      price: member ? (billing === "annual" ? "80" : "9.99") : priceStr,
      interval: member ? (billing === "annual" ? "yr" : "mo") : annual ? "yr" : "mo",
      features: [
        member
          ? "Active — every reward below is yours"
          : promo
            ? `${promo.code.toUpperCase()} applied — ${promo.percentOff}% off${isFree ? " (free)" : `, was $${formatPrice(basePrice)}`}`
            : annual
              ? "Billed $80/year — save 33%"
              : "7-day free trial, then $9.99/mo",
        "Unlimited car scans",
        "Wishlist auctions + car alerts",
        "Auctions 24h early",
        "Members-only Garage",
        "Auto-bid + market-value insight",
        "48h early access to new features",
      ],
      buttonText: carzButtonText,
      isPopular: true,
      buttonVariant: "primary",
      onSelect: joinCarzPlus,
    },
  ];

  // Members get their status, not the join controls — the billing toggle and
  // promo box only mean anything to someone who hasn't subscribed yet.
  const header = member ? (
    <div className="flex flex-col items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-1.5 text-sm text-cyan-300">
        <span className="font-semibold">Carz+ active</span>
        <span className="opacity-80">· {billing === "annual" ? "$80/yr" : "$9.99/mo"}</span>
      </div>
      <p className="text-sm text-foreground/70">Everything below is already unlocked.</p>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-4">
      <div className="blur-behind inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 text-sm">
        <button
          onClick={() => setAnnual(false)}
          className={cn("press rounded-full px-4 py-1.5 font-medium transition", !annual ? "bg-cyan-400 text-black" : "text-foreground/70 hover:text-foreground")}
        >
          Monthly
        </button>
        <button
          onClick={() => setAnnual(true)}
          className={cn("press rounded-full px-4 py-1.5 font-medium transition", annual ? "bg-cyan-400 text-black" : "text-foreground/70 hover:text-foreground")}
        >
          Annual <span className="opacity-70">· save 33%</span>
        </button>
      </div>

      {/* Promo code slot */}
      {promo ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-300">
          <span className="font-semibold uppercase tracking-wide">{promo.code}</span>
          <span className="opacity-80">· {promo.percentOff}% off applied</span>
          <button onClick={removePromo} className="press ml-1 opacity-70 hover:opacity-100" aria-label="Remove promo code">
            &times;
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <input
              value={promoInput}
              onChange={(e) => {
                setPromoInput(e.target.value);
                setPromoError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyPromo();
              }}
              placeholder="Promo code"
              className="w-40 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm outline-none placeholder:text-foreground/40 focus:border-white/40"
            />
            <button
              onClick={applyPromo}
              className="press rounded-full border border-white/20 px-4 py-1.5 text-sm font-medium text-foreground/80 transition hover:border-white/40 hover:text-foreground"
            >
              Apply
            </button>
          </div>
          {promoError && <p className="text-xs text-[color:var(--coral,#ff5a5f)]">{promoError}</p>}
        </div>
      )}
      {joinError && <p className="text-xs text-[color:var(--coral,#ff5a5f)]">{joinError}</p>}
    </div>
  );

  return (
    <>
      <ModernPricingPage
        title={
          member ? (
            <>
              Your <span className="text-cyan-400">Carz+</span> rewards
            </>
          ) : (
            <>
              Choose your <span className="text-cyan-400">Carz</span> plan
            </>
          )
        }
        subtitle={
          member
            ? "You're subscribed. Every reward is live on your account right now."
            : "Start free. Upgrade to Carz+ for early auctions, auto-bid, alerts and more."
        }
        plans={plans}
        headerExtra={header}
        showAnimatedBackground
      />
    </>
  );
}

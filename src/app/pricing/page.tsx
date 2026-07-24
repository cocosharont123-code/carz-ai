"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { SiteHeader } from "@/components/site-header";
import { ModernPricingPage, type PricingCardProps } from "@/components/ui/animated-glassy-pricing";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [busy, setBusy] = useState(false);
  const [annual, setAnnual] = useState(false);

  function post(body: Record<string, unknown>) {
    return fetch("/api/membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }

  async function joinCarzPlus() {
    if (busy) return;
    if (status !== "authenticated") {
      signIn("google", { callbackUrl: "/pricing" });
      return;
    }
    setBusy(true);
    try {
      let d;
      if (annual) {
        // Annual is a direct purchase.
        d = await post({ action: "join", interval: "annual" });
      } else {
        // Monthly starts the free trial; fall back to joining if already used.
        d = await post({ action: "trial" });
        if (!d?.ok && !d?.needUsername) d = await post({ action: "join", interval: "monthly" });
      }
      if (d?.needUsername) {
        router.push("/profile?next=/pricing");
        return;
      }
      // Started trial / joined — send them to their member area.
      router.push("/membership");
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  const plans: PricingCardProps[] = [
    {
      planName: "Free",
      description: "Get started spotting and bidding.",
      price: "0",
      features: ["3 car scans per day", "Bid on auctions", "Live leaderboard", "Car Hunt events"],
      buttonText: "Start spotting",
      buttonVariant: "secondary",
      onSelect: () => router.push("/spot"),
    },
    {
      planName: "Carz+",
      description: "The membership for serious spotters.",
      price: annual ? "80" : "9.99",
      interval: annual ? "yr" : "mo",
      features: [
        annual ? "Billed $80/year — save 33%" : "7-day free trial, then $9.99/mo",
        "Unlimited car scans",
        "Wishlist auctions + car alerts",
        "Auctions 24h early",
        "Members-only Garage",
        "Auto-bid + market-value insight",
        "48h early access to new features",
      ],
      buttonText: busy ? "Starting…" : annual ? "Get annual · $80/yr" : "Start free trial",
      isPopular: true,
      buttonVariant: "primary",
      onSelect: joinCarzPlus,
    },
  ];

  const billingToggle = (
    <div className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 text-sm backdrop-blur">
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
  );

  return (
    <>
      <SiteHeader />
      <ModernPricingPage
        title={
          <>
            Choose your <span className="text-cyan-400">Carz</span> plan
          </>
        }
        subtitle="Start free. Upgrade to Carz+ for early auctions, auto-bid, alerts and more."
        plans={plans}
        headerExtra={billingToggle}
        showAnimatedBackground
      />
    </>
  );
}

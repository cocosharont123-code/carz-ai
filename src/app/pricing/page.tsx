"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { SiteHeader } from "@/components/site-header";
import { ModernPricingPage, type PricingCardProps } from "@/components/ui/animated-glassy-pricing";

export default function PricingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [busy, setBusy] = useState(false);

  async function joinCarzPlus() {
    if (busy) return;
    if (status !== "authenticated") {
      signIn("google", { callbackUrl: "/pricing" });
      return;
    }
    setBusy(true);
    try {
      const d = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join" }),
      }).then((r) => r.json());
      if (d?.needUsername) {
        router.push("/profile?next=/pricing");
        return;
      }
      // Joined — send them to their member area.
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
      price: "10",
      features: [
        "Unlimited car scans",
        "Wishlist auctions + car alerts",
        "Auctions 24h early",
        "Members-only Garage",
        "Auto-bid + market-value insight",
        "48h early access to new features",
      ],
      buttonText: busy ? "Joining…" : "Get Carz+",
      isPopular: true,
      buttonVariant: "primary",
      onSelect: joinCarzPlus,
    },
  ];

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
        showAnimatedBackground
      />
    </>
  );
}

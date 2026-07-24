"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/editorial";

type Status = {
  signedIn: boolean;
  hasUsername?: boolean;
  member: boolean;
  memberSince?: number | null;
  billing?: "monthly" | "annual";
  trialEndsAt?: number | null;
  trialUsed?: boolean;
  streak: number;
};

const PERKS: { icon: string; title: string; desc: string }[] = [
  { icon: "⏱", title: "Auctions 24h early", desc: "See and bid on every listing a full day before non-members." },
  { icon: "♾️", title: "Unlimited AI scans", desc: "No caps on car identifications, ever." },
  { icon: "🗺️", title: "Spotting map", desc: "The live map of where to find cars near you." },
  { icon: "🎥", title: "Spot cars in videos", desc: "Scan a video and identify every car in it, frame by frame." },
  { icon: "🔔", title: "Car alerts", desc: "Get notified the moment a wishlisted car is listed or sold." },
  { icon: "🤖", title: "Auto-bid", desc: "Set a max price and the AI bids for you — it knows market value." },
  { icon: "📊", title: "Market-value insight", desc: "See exactly how far over or under market value a car is selling." },
  { icon: "📍", title: "Radius alerts", desc: "Ping when a rare car is spotted near you." },
  { icon: "🏠", title: "My Garage", desc: "Your full spotting history — members only." },
  { icon: "🔥", title: "Day streaks", desc: "Build a streak; restore a lost one for $0.99." },
  { icon: "🚀", title: "48h early access", desc: "Every new Carz feature reaches you 2 days before anyone else." },
];

export default function MembershipPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

  async function load() {
    const d = await fetch("/api/membership", { cache: "no-store" }).then((r) => r.json());
    setS(d);
    setTrialDaysLeft(d?.trialEndsAt ? Math.max(0, Math.ceil((d.trialEndsAt - Date.now()) / 86_400_000)) : 0);
  }
  useEffect(() => {
    load();
  }, [authStatus]);

  async function join(interval: "monthly" | "annual" = "monthly") {
    if (authStatus !== "authenticated") {
      signIn("google", { callbackUrl: "/membership" });
      return;
    }
    setError("");
    setBusy(true);
    try {
      const d = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", interval }),
      }).then((r) => r.json());
      if (!d.ok) {
        if (d.needUsername) {
          router.push("/profile?next=/membership");
          return;
        }
        setError(d.error || "Couldn't join.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function startTrial() {
    if (authStatus !== "authenticated") {
      signIn("google", { callbackUrl: "/membership" });
      return;
    }
    setError("");
    setBusy(true);
    try {
      const d = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trial" }),
      }).then((r) => r.json());
      if (!d.ok) {
        if (d.needUsername) {
          router.push("/profile?next=/membership");
          return;
        }
        setError(d.error || "Couldn't start your trial.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (authStatus !== "authenticated") {
      signIn("google", { callbackUrl: "/membership" });
      return;
    }
    setPromoError("");
    if (!code.trim()) {
      setPromoError("Enter a promo code.");
      return;
    }
    setBusy(true);
    try {
      const d = await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "redeem", code }),
      }).then((r) => r.json());
      if (!d.ok) {
        if (d.needUsername) {
          router.push("/profile?next=/membership");
          return;
        }
        setPromoError(d.error || "That promo code isn't valid.");
        return;
      }
      setCode("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    setBusy(true);
    try {
      await fetch("/api/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", restoreTo: (s?.streak ?? 0) + 1 }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  const member = !!s?.member;
  const onTrial = member && !!s?.trialEndsAt;
  const trialAvailable = !s?.trialUsed;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        {/* Hero offer */}
        <div className="reveal rounded-3xl border border-white/12 bg-card p-8 text-center">
          <div className="util-label">Carz+ membership</div>
          <h1 className="display mt-2 text-4xl">
            {member ? "You're a member" : "Get more from every car"}
          </h1>
          {member ? (
            <>
              <p className="mt-2 text-sm">🔥 {s?.streak ?? 0}-day streak</p>
              <div className="mt-5 flex flex-col items-center gap-2">
                {onTrial ? (
                  <span className="rounded-full border border-carz/40 px-4 py-1.5 text-xs text-carz">
                    Free trial · {trialDaysLeft} {trialDaysLeft === 1 ? "day" : "days"} left · then $9.99/mo
                  </span>
                ) : (
                  <span className="rounded-full border border-white/15 px-4 py-1.5 text-xs">
                    Active · {s?.billing === "annual" ? "$80/yr" : "$9.99/mo"}
                  </span>
                )}
                <button onClick={restore} disabled={busy} className="press text-xs underline underline-offset-4 opacity-70 hover:opacity-100">
                  Lost your streak? Restore it for $0.99
                </button>
              </div>
            </>
          ) : (
            <>
              {trialAvailable ? (
                <>
                  <p className="mx-auto mt-3 max-w-md text-sm">
                    <span className="display text-3xl">7 days free</span>
                    <span className="opacity-70">, then $9.99 / month.</span> Cancel anytime.
                  </p>
                  <Button onClick={startTrial} disabled={busy} size="lg" className="mt-5">
                    {busy ? "…" : authStatus === "authenticated" ? "Start 7-day free trial" : "Sign in to start free trial"}
                  </Button>
                  <button
                    onClick={() => join("monthly")}
                    disabled={busy}
                    className="press mt-3 block text-xs underline underline-offset-4 opacity-60 hover:opacity-100"
                  >
                    Skip the trial — join now for $9.99/mo
                  </button>
                </>
              ) : (
                <>
                  <p className="mx-auto mt-3 max-w-md text-sm">
                    <span className="display text-3xl">$9.99</span>
                    <span className="opacity-70"> / month.</span> Cancel anytime.
                  </p>
                  <Button onClick={() => join("monthly")} disabled={busy} size="lg" className="mt-5">
                    {busy ? "…" : authStatus === "authenticated" ? "Join Carz+" : "Sign in to join"}
                  </Button>
                </>
              )}

              {/* Annual option */}
              <button
                onClick={() => join("annual")}
                disabled={busy}
                className="press mt-3 block w-full text-xs opacity-70 hover:opacity-100"
              >
                Or get a year for <span className="font-semibold">$80</span> — save 33%
              </button>
              {error && <p className="mt-2 text-sm text-nred">{error}</p>}

              {/* Promo code */}
              <div className="mx-auto mt-6 max-w-xs">
                <div className="util-label opacity-60">Have a promo code?</div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setPromoError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") redeem();
                    }}
                    placeholder="Enter code"
                    className="w-full rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm outline-none placeholder:opacity-40 focus:border-white/30"
                  />
                  <Button onClick={redeem} disabled={busy} size="md">
                    Redeem
                  </Button>
                </div>
                {promoError && <p className="mt-2 text-sm text-nred">{promoError}</p>}
              </div>
            </>
          )}
        </div>

        {/* Perks */}
        <h2 className="display mt-8 text-2xl">What you get</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PERKS.map((p) => (
            <div key={p.title} className="glass-card reveal press lift flex items-start gap-3 rounded-2xl p-4">
              <div className="text-2xl">{p.icon}</div>
              <div>
                <p className="text-[15px] font-semibold">{p.title}</p>
                <p className="mt-0.5 text-[13px] opacity-70">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {!member && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button onClick={trialAvailable ? startTrial : () => join("monthly")} disabled={busy} size="lg">
              {authStatus !== "authenticated"
                ? "Sign in to join"
                : trialAvailable
                  ? "Start 7-day free trial"
                  : "Join Carz+ · $9.99/mo"}
            </Button>
            <Link href="/pricing" className="press util-label opacity-60 hover:opacity-100">
              See the full plan comparison →
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

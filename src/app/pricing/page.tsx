"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";

export default function PricingPage() {
  const router = useRouter();
  const [current, setCurrent] = useState<PlanId | null>(null);
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [promo, setPromo] = useState("");
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  async function redeem() {
    if (!promo.trim()) return;
    setRedeeming(true);
    setPromoMsg(null);
    try {
      const r = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo }),
      });
      const data = await r.json();
      if (data.ok) {
        setCurrent(data.plan);
        setPromoMsg({ ok: true, text: `🎉 Code applied — you're on ${data.planName} for free!` });
        setTimeout(() => router.push("/spot"), 1300);
      } else {
        setPromoMsg({ ok: false, text: data.error || "Invalid code." });
      }
    } catch {
      setPromoMsg({ ok: false, text: "Something went wrong — try again." });
    } finally {
      setRedeeming(false);
    }
  }

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((s) => setCurrent(s.plan))
      .catch(() => {});
  }, []);

  async function choose(plan: PlanId) {
    setBusy(plan);
    try {
      const r = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await r.json();
      if (data.ok) {
        setCurrent(plan);
        router.push("/spot");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-5 py-14">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">Simple, spotter-friendly pricing</h1>
          <p className="mt-3 text-muted-foreground">
            Start free. Upgrade when you&apos;re spotting more.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = current === id;
            const highlight = id === "max";
            return (
              <div
                key={id}
                className={`relative flex flex-col rounded-3xl border p-7 backdrop-blur-xl transition-colors ${
                  highlight
                    ? "border-violet-500/40 bg-gradient-to-b from-violet-500/15 to-card shadow-xl shadow-violet-500/10"
                    : "border-white/[0.06] bg-card"
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 left-6 rounded-full bg-violet-500 px-3 py-0.5 text-xs font-bold text-white">
                    Most powerful
                  </span>
                )}
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">
                    ${plan.price === 0 ? "0" : plan.price}
                  </span>
                  <span className="text-muted-foreground">/mo</span>
                </div>

                <ul className="mt-6 flex-1 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-0.5 text-emerald-400">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrent || busy !== null}
                  onClick={() => choose(id)}
                  className={`mt-7 rounded-xl px-4 py-2.5 font-semibold transition disabled:opacity-60 ${
                    highlight
                      ? "bg-gradient-to-br from-sky-400 to-violet-500 text-white hover:opacity-90"
                      : "border border-border bg-background hover:bg-accent"
                  }`}
                >
                  {isCurrent
                    ? "Current plan"
                    : busy === id
                      ? "Activating…"
                      : plan.price === 0
                        ? "Switch to Free"
                        : `Get ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-12 max-w-md rounded-3xl border border-white/[0.06] bg-card p-6 text-center backdrop-blur-xl">
          <h3 className="font-bold">Have a promo code?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Redeem it for free access.</p>
          <div className="mt-4 flex gap-2">
            <input
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && redeem()}
              placeholder="Enter code"
              className="flex-1 rounded-xl border border-white/10 bg-background px-3 py-2 text-sm outline-none transition focus:border-white/25"
            />
            <button
              onClick={redeem}
              disabled={redeeming || !promo.trim()}
              className="rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-5 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {redeeming ? "…" : "Redeem"}
            </button>
          </div>
          {promoMsg && (
            <p className={`mt-3 text-sm ${promoMsg.ok ? "text-emerald-400" : "text-red-300"}`}>{promoMsg.text}</p>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Demo billing — upgrades activate instantly without payment. Wire Stripe Checkout
          in <code className="rounded bg-card px-1">/api/upgrade</code> for real charges (see README).
        </p>
      </main>
    </>
  );
}

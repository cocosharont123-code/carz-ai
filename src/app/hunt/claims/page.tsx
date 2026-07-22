"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { SiteHeader } from "@/components/site-header";

type Claim = {
  id: string;
  carName: string;
  bounty: number;
  cashapp: string;
  image: string;
  spotter: string;
  ts: number;
  status: string;
};

const money = (n: number) => "$" + n.toLocaleString("en-US");
const fmt = (ts: number) => new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default function ClaimsPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [claims, setClaims] = useState<Claim[]>([]);

  useEffect(() => {
    if (status === "loading") return;
    fetch("/api/hunt/claim")
      .then((r) => r.json())
      .then((d) => {
        setIsOwner(!!d.isOwner);
        setClaims(Array.isArray(d.claims) ? d.claims : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-8">
        <h1 className="text-2xl font-black tracking-tight">💵 Prize claims</h1>
        <p className="mt-1 text-sm text-muted-foreground">Review verified spots and pay out via CashApp.</p>

        {loading ? (
          <div className="mt-6 h-40 animate-pulse rounded-3xl bg-foreground/[0.04]" />
        ) : status !== "authenticated" ? (
          <div className="mt-8 rounded-3xl border border-foreground/[0.06] bg-card p-8 text-center">
            <h3 className="text-lg font-bold">Owner only</h3>
            <p className="mt-1 text-sm text-muted-foreground">Sign in with the owner account to see claims.</p>
            <button
              onClick={() => signIn("google", { callbackUrl: "/hunt/claims" })}
              className="mt-4 rounded-xl bg-white px-5 py-2.5 font-semibold text-[#1f1f1f]"
            >
              Continue with Google
            </button>
          </div>
        ) : !isOwner ? (
          <div className="mt-8 rounded-3xl border border-neon-red/30 bg-neon-red/10 p-6 text-center text-sm text-neon-red">
            This page is only visible to the hunt owner.
          </div>
        ) : claims.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-foreground/[0.06] bg-card p-8 text-center">
            <div className="text-4xl">📭</div>
            <h3 className="mt-2 font-bold">No claims yet</h3>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {claims.map((c) => (
              <div key={c.id} className="flex gap-3 rounded-2xl border border-foreground/[0.07] bg-card p-3">
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-foreground/[0.04]">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt={c.carName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">🚗</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {c.carName} · <span className="text-neon-green">{money(c.bounty)}</span>
                  </p>
                  <p className="mt-0.5 text-sm">
                    Pay: <span className="select-all font-mono font-bold">{c.cashapp}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    by {c.spotter} · {fmt(c.ts)} · {c.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

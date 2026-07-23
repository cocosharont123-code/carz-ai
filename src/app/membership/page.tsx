"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button, Card } from "@/components/ui/editorial";

type Status = { signedIn: boolean; hasUsername?: boolean; member: boolean; memberSince?: number | null; streak: number };

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

  async function load() {
    const d = await fetch("/api/membership", { cache: "no-store" }).then((r) => r.json());
    setS(d);
  }
  useEffect(() => {
    load();
  }, [authStatus]);

  async function join() {
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
        body: JSON.stringify({ action: "join" }),
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
                <span className="rounded-full border border-white/15 px-4 py-1.5 text-xs">Active · $9.99/mo</span>
                <button onClick={restore} disabled={busy} className="press text-xs underline underline-offset-4 opacity-70 hover:opacity-100">
                  Lost your streak? Restore it for $0.99
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mx-auto mt-3 max-w-md text-sm">
                <span className="display text-3xl">$9.99</span>
                <span className="opacity-70"> / month.</span> Cancel anytime.
              </p>
              <Button onClick={join} disabled={busy} size="lg" className="mt-5">
                {busy ? "…" : authStatus === "authenticated" ? "Join Carz+" : "Sign in to join"}
              </Button>
              {error && <p className="mt-2 text-sm text-nred">{error}</p>}
            </>
          )}
        </div>

        {/* Perks */}
        <h2 className="display mt-8 text-2xl">What you get</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PERKS.map((p) => (
            <Card key={p.title} className="reveal press lift flex items-start gap-3 p-4">
              <div className="text-2xl">{p.icon}</div>
              <div>
                <p className="text-[15px] font-semibold">{p.title}</p>
                <p className="mt-0.5 text-[13px] opacity-70">{p.desc}</p>
              </div>
            </Card>
          ))}
        </div>

        {!member && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button onClick={join} disabled={busy} size="lg">
              {authStatus === "authenticated" ? "Join Carz+ · $9.99/mo" : "Sign in to join"}
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

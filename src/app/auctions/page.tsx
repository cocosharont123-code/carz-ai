"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

type Auction = {
  id: string;
  title: string;
  make: string;
  model: string;
  image: string;
  currentBid: number;
  startingBid: number;
  bidCount: number;
  sellerName: string;
  endsAt: number;
  ended: boolean;
  topBidderName: string;
};

function fmtMoney(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function timeLeft(endsAt: number, now: number): { text: string; ending: boolean; ended: boolean } {
  const d = endsAt - now;
  if (d <= 0) return { text: "Ended", ending: false, ended: true };
  const days = Math.floor(d / 86_400_000);
  const h = Math.floor((d % 86_400_000) / 3_600_000);
  const m = Math.floor((d % 3_600_000) / 60_000);
  const s = Math.floor((d % 60_000) / 1000);
  const ending = d < 3_600_000;
  if (days > 0) return { text: `${days}d ${h}h left`, ending, ended: false };
  if (h > 0) return { text: `${h}h ${m}m left`, ending, ended: false };
  return { text: `${m}m ${String(s).padStart(2, "0")}s left`, ending, ended: false };
}

function Card({ a, now }: { a: Auction; now: number }) {
  const tl = timeLeft(a.endsAt, now);
  return (
    <Link
      href={`/auctions/${a.id}`}
      className="group overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card backdrop-blur-xl transition hover:border-foreground/20"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-foreground/[0.04]">
        {a.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image} alt={a.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🚗</div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold backdrop-blur ${
            tl.ended ? "bg-foreground/20 text-foreground/70" : tl.ending ? "bg-rose-500/90 text-white" : "bg-black/55 text-white"
          }`}
        >
          {tl.ending && !tl.ended ? "🔥 " : "⏱ "}
          {tl.text}
        </span>
      </div>
      <div className="p-3.5">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug">{a.title}</p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {a.bidCount > 0 ? "Current bid" : "Starting bid"}
            </div>
            <div className="text-lg font-extrabold">{fmtMoney(a.currentBid)}</div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>{a.bidCount} bid{a.bidCount === 1 ? "" : "s"}</div>
            <div className="truncate max-w-[8rem]">by {a.sellerName}</div>
          </div>
        </div>
        <div className="mt-3 block w-full rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 py-2.5 text-center text-sm font-bold text-white">
          {tl.ended ? "View result" : "Bid now →"}
        </div>
      </div>
    </Link>
  );
}

export default function AuctionsPage() {
  const now = useNow();
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auctions", { cache: "no-store" });
      const d = await res.json();
      setConfigured(d.configured !== false);
      setItems(Array.isArray(d.auctions) ? d.auctions : []);
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15000); // keep bids fresh
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">🔨 Carz Auctions</h1>
            <p className="mt-1 text-muted-foreground">
              List your car, or win a bidding war — the winner gets the seller&apos;s contact to close the deal.
            </p>
          </div>
          <Link
            href="/auctions/new"
            className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-background transition hover:opacity-90"
          >
            + List your car
          </Link>
        </div>

        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-2xl bg-foreground/[0.04]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-foreground/[0.06] bg-card p-10 text-center backdrop-blur-xl">
            <div className="text-4xl">🏁</div>
            <h3 className="mt-3 text-lg font-bold">No auctions live yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Be the first to list a car for auction.</p>
            <Link
              href="/auctions/new"
              className="mt-4 inline-block rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-5 py-2.5 font-semibold text-white"
            >
              List your car
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <Card key={a.id} a={a} now={now} />
            ))}
          </div>
        )}

        {!configured && (
          <p className="mt-6 text-center text-xs text-muted-foreground">Auctions storage is warming up…</p>
        )}
      </main>
    </>
  );
}

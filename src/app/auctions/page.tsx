"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button, PageMasthead, CarPhoto, LiveDot, Skeleton } from "@/components/ui/editorial";

type Auction = {
  id: string;
  title: string;
  year: string;
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

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

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
  const ending = d < 3_600_000;
  if (days > 0) return { text: `${days}d ${h}h left`, ending, ended: false };
  if (h > 0) return { text: `${h}h ${m}m left`, ending, ended: false };
  return { text: `${m}m left`, ending, ended: false };
}

function AuctionCard({ a, now }: { a: Auction; now: number }) {
  const tl = timeLeft(a.endsAt, now);
  return (
    <Link href={`/auctions/${a.id}`} className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card text-card-foreground transition-colors hover:border-white/25">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <CarPhoto src={a.image} alt={a.title} />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 bg-black/70 text-white px-2 py-1">
          {!tl.ended && <LiveDot />}
          <span className="util-label ">{tl.text}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug ">{a.title}</p>
        <div className="mt-2 flex items-end justify-between">
          <div>
            <div className="util-label ">{a.bidCount > 0 ? "Current bid" : "Starting"}</div>
            <div className="display text-3xl ">{money(a.currentBid)}</div>
          </div>
          <div className="text-right">
            <div className="util-label ">{a.bidCount} bids</div>
            <div className="util-label max-w-[8rem] truncate ">{a.sellerName}</div>
          </div>
        </div>
        <span className="mt-4 inline-flex justify-center border border-white/40 px-4 py-2.5 util-label  transition-colors group-hover:border-carz group-hover:bg-carz ">
          {tl.ended ? "View result" : "Bid now →"}
        </span>
      </div>
    </Link>
  );
}

export default function AuctionsPage() {
  const now = useNow();
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auctions", { cache: "no-store" });
      const d = await res.json();
      setItems(Array.isArray(d.auctions) ? d.auctions : []);
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 15000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        <PageMasthead
          eyebrow="Bidding wars · winner takes the deal"
          title="Live Auctions"
          count={loading ? "—" : `${items.length} live`}
          action={<Button href="/auctions/new" size="sm">+ List your car</Button>}
        />

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-card text-card-foreground p-4">
                <Skeleton className="aspect-[4/3] w-full" />
                <Skeleton className="mt-3 h-4 w-2/3" />
                <Skeleton className="mt-2 h-8 w-1/2" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-10 border border-white/10 bg-card text-card-foreground p-12 text-center">
            <h3 className="display text-4xl">No auctions live</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm ">Be the first — list a car and start a bidding war.</p>
            <Button href="/auctions/new" className="mt-6">List your car</Button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {items.map((a) => (
              <AuctionCard key={a.id} a={a} now={now} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

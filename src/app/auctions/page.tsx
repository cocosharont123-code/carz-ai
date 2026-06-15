"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";

type Auction = {
  id: string;
  title: string;
  currentBid: number;
  currency: string;
  bids: number;
  endsAt: number;
  image: string;
  url: string;
  location: string;
};

const CATEGORIES = ["Classic", "JDM", "Porsche", "Mustang", "Trucks", "Project car"];

function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function timeLeft(endsAt: number, now: number): { text: string; ending: boolean; ended: boolean } {
  const ms = endsAt - now;
  if (ms <= 0) return { text: "Ended", ending: false, ended: true };
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const ending = ms < 3_600_000;
  if (d > 0) return { text: `${d}d ${h}h left`, ending, ended: false };
  if (h > 0) return { text: `${h}h ${m}m left`, ending, ended: false };
  return { text: `${m}m ${String(s).padStart(2, "0")}s left`, ending, ended: false };
}

function AuctionCard({ a, now }: { a: Auction; now: number }) {
  const tl = timeLeft(a.endsAt, now);
  return (
    <div className="group overflow-hidden rounded-2xl border border-foreground/[0.07] bg-card backdrop-blur-xl transition hover:border-foreground/20">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-foreground/[0.04]">
        {a.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image} alt={a.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🚗</div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold backdrop-blur ${
            tl.ended
              ? "bg-foreground/20 text-foreground/70"
              : tl.ending
                ? "bg-rose-500/90 text-white"
                : "bg-black/55 text-white"
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
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Current bid</div>
            <div className="text-lg font-extrabold">{fmtMoney(a.currentBid, a.currency)}</div>
          </div>
          <div className="text-right text-[11px] text-muted-foreground">
            <div>{a.bids} bid{a.bids === 1 ? "" : "s"}</div>
            {a.location ? <div className="truncate max-w-[8rem]">{a.location}</div> : null}
          </div>
        </div>
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 block w-full rounded-xl py-2.5 text-center text-sm font-bold transition ${
            tl.ended
              ? "pointer-events-none bg-foreground/[0.06] text-muted-foreground"
              : "bg-gradient-to-br from-sky-400 to-violet-500 text-white hover:brightness-110"
          }`}
        >
          {tl.ended ? "Auction ended" : "Bid through Carz →"}
        </a>
      </div>
    </div>
  );
}

export default function AuctionsPage() {
  const now = useNow();
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [source, setSource] = useState("eBay Motors");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const reqId = useRef(0);

  const load = useCallback(async (q: string) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/auctions?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      if (id !== reqId.current) return; // stale response
      setConfigured(d.configured !== false);
      setSource(d.source || "eBay Motors");
      setItems(Array.isArray(d.items) ? d.items : []);
    } catch {
      if (id === reqId.current) setItems([]);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setActive("");
    load(query.trim());
  }

  function pickCategory(c: string) {
    const next = active === c ? "" : c;
    setActive(next);
    setQuery("");
    load(next);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">🔨 Carz Auctions</h1>
            <p className="mt-1 text-muted-foreground">
              Live car auctions from across the web — bid through Carz.
            </p>
          </div>
          <span className="rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-1 text-xs text-muted-foreground">
            Powered by {source}
          </span>
        </div>

        {!configured && (
          <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-300">
            <span className="font-semibold">Preview mode.</span> These are sample auctions. Connect an
            eBay App ID (<code className="rounded bg-foreground/10 px-1">EBAY_APP_ID</code>) and the feed goes
            live with real bids ending soonest.
          </div>
        )}

        <form onSubmit={submit} className="mt-6 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search auctions — e.g. 911, Supra, F-150…"
            className="w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] px-4 py-2.5 text-sm outline-none focus:border-foreground/25"
          />
          <button
            type="submit"
            className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-background transition hover:opacity-90"
          >
            Search
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => pickCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                active === c
                  ? "border-violet-500/60 bg-violet-500/15 text-violet-300"
                  : "border-foreground/10 bg-foreground/[0.04] text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
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
            <h3 className="mt-3 text-lg font-bold">No live auctions match that</h3>
            <p className="mt-1 text-sm text-muted-foreground">Try a different make, model, or category.</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <AuctionCard key={a.id} a={a} now={now} />
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Auctions are aggregated from {source}. Carz links you straight to the live listing to place your bid.
        </p>
      </main>
    </>
  );
}

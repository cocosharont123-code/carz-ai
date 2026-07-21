"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { SiteHeader } from "@/components/site-header";

type Bid = { bidderName: string; amount: number; ts: number };
type Auction = {
  id: string;
  title: string;
  make: string;
  model: string;
  year: string;
  description: string;
  image: string;
  startingBid: number;
  currentBid: number;
  bidCount: number;
  sellerName: string;
  topBidderName: string;
  bids: Bid[];
  endsAt: number;
  ended: boolean;
  youAreSeller: boolean;
  youAreWinner: boolean;
  contact?: string;
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function countdown(endsAt: number, now: number) {
  const d = endsAt - now;
  if (d <= 0) return "Ended";
  const days = Math.floor(d / 86_400_000);
  const h = Math.floor((d % 86_400_000) / 3_600_000);
  const m = Math.floor((d % 3_600_000) / 60_000);
  const s = Math.floor((d % 60_000) / 1000);
  if (days > 0) return `${days}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function AuctionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const now = useNow();
  const { status } = useSession();
  const [a, setA] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [amount, setAmount] = useState("");
  const [bidding, setBidding] = useState(false);
  const [msg, setMsg] = useState("");
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${id}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const d = await res.json();
      if (d.auction) setA(d.auction);
      else setNotFound(true);
    } catch {
      /* keep */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    poll.current = setInterval(load, 8000);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [load]);

  async function placeBid() {
    if (status !== "authenticated") {
      signIn("google", { callbackUrl: `/auctions/${id}` });
      return;
    }
    setMsg("");
    setBidding(true);
    try {
      const res = await fetch(`/api/auctions/${id}/bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) || 0 }),
      });
      const d = await res.json();
      if (!d.ok) {
        setMsg(d.error || "Couldn't place bid.");
        return;
      }
      setA(d.auction);
      setAmount("");
      setMsg("🎉 You're the top bidder!");
    } catch {
      setMsg("Network error — try again.");
    } finally {
      setBidding(false);
    }
  }

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-5 py-10">
          <div className="h-96 animate-pulse rounded-3xl bg-foreground/[0.04]" />
        </main>
      </>
    );
  }

  if (notFound || !a) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-5 py-20 text-center">
          <div className="text-4xl">🤷</div>
          <h1 className="mt-3 text-2xl font-bold">Auction not found</h1>
          <Link href="/auctions" className="mt-4 inline-block text-sky-400 underline">
            Back to auctions
          </Link>
        </main>
      </>
    );
  }

  const ended = a.ended || now >= a.endsAt;
  const minNext = a.bidCount > 0 ? a.currentBid + 1 : a.startingBid;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <Link href="/auctions" className="text-sm text-muted-foreground hover:text-foreground">
          ← All auctions
        </Link>

        <div className="mt-3 overflow-hidden rounded-3xl border border-foreground/[0.06] bg-card">
          <div className="relative aspect-[16/10] w-full bg-foreground/[0.04]">
            {a.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt={a.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl">🚗</div>
            )}
            <span
              className={`absolute left-3 top-3 rounded-full px-3 py-1 text-sm font-bold backdrop-blur ${
                ended ? "bg-foreground/20 text-foreground/80" : now < a.endsAt && a.endsAt - now < 3_600_000 ? "bg-rose-500/90 text-white" : "bg-black/60 text-white"
              }`}
            >
              {ended ? "⏱ Ended" : `⏱ ${countdown(a.endsAt, now)}`}
            </span>
          </div>

          <div className="p-5">
            <h1 className="text-2xl font-extrabold tracking-tight">{a.title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Listed by {a.sellerName}
              {a.year || a.make || a.model ? ` · ${[a.year, a.make, a.model].filter(Boolean).join(" ")}` : ""}
            </p>

            <div className="mt-4 flex items-end justify-between rounded-2xl bg-foreground/[0.04] p-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {a.bidCount > 0 ? "Current bid" : "Starting bid"}
                </div>
                <div className="text-3xl font-extrabold">{money(a.currentBid)}</div>
                <div className="text-xs text-muted-foreground">
                  {a.bidCount} bid{a.bidCount === 1 ? "" : "s"}
                  {a.topBidderName ? ` · top: ${a.topBidderName}` : ""}
                </div>
              </div>
              {!ended && (
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Ends in</div>
                  <div className="font-mono text-lg font-bold">{countdown(a.endsAt, now)}</div>
                </div>
              )}
            </div>

            {/* Bidding / result */}
            {ended ? (
              <ResultBox a={a} />
            ) : a.youAreSeller ? (
              <p className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3 text-sm text-muted-foreground">
                This is your listing — you can&apos;t bid on it. Share the link to get a bidding war going!
              </p>
            ) : (
              <div className="mt-4">
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center rounded-xl border border-foreground/15 bg-foreground/[0.04] px-3">
                    <span className="text-muted-foreground">$</span>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      placeholder={`${minNext.toLocaleString()} or more`}
                      className="w-full bg-transparent px-1 py-3 text-sm outline-none"
                    />
                  </div>
                  <button
                    onClick={placeBid}
                    disabled={bidding}
                    className="rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {bidding ? "Bidding…" : status !== "authenticated" ? "Sign in to bid" : "Place bid"}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">Minimum next bid: {money(minNext)}</p>
                {msg && <p className="mt-2 text-sm text-emerald-300">{msg}</p>}
              </div>
            )}

            {a.description && (
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Description</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{a.description}</p>
              </div>
            )}

            {/* Bid history */}
            {a.bids.length > 0 && (
              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Bid history</h3>
                <div className="mt-2 space-y-1.5">
                  {a.bids.map((b, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-3 py-2 text-sm">
                      <span className="font-semibold">{b.bidderName}</span>
                      <span>{money(b.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function ResultBox({ a }: { a: Auction }) {
  if (a.bidCount === 0) {
    return (
      <p className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">
        This auction ended with no bids.
      </p>
    );
  }
  // Winner sees the seller's contact. Seller sees who won.
  if (a.youAreWinner && a.contact) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
        <h3 className="font-bold text-emerald-300">🏆 You won for {money(a.currentBid)}!</h3>
        <p className="mt-1 text-sm text-muted-foreground">Contact the seller to arrange the sale:</p>
        <p className="mt-2 select-all rounded-lg bg-background/60 px-3 py-2 font-mono text-sm">{a.contact}</p>
      </div>
    );
  }
  if (a.youAreSeller) {
    return (
      <div className="mt-4 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4">
        <h3 className="font-bold text-sky-300">Auction ended — sold for {money(a.currentBid)}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Winner: <span className="font-semibold text-foreground">{a.topBidderName}</span>. They&apos;ve been shown your
          contact info to reach out.
        </p>
        {a.contact && (
          <p className="mt-2 select-all rounded-lg bg-background/60 px-3 py-2 font-mono text-sm">
            Your listed contact: {a.contact}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-2xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <h3 className="font-bold">Auction ended — won by {a.topBidderName}</h3>
      <p className="mt-1 text-sm text-muted-foreground">Final bid {money(a.currentBid)}. The winner gets the seller&apos;s contact.</p>
    </div>
  );
}

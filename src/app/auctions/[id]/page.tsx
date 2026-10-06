"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { Button, CarPhoto, DataTable, LiveDot } from "@/components/ui/editorial";

type Bid = { bidderName: string; amount: number; ts: number };
type Auction = {
  id: string;
  title: string;
  make: string;
  model: string;
  year: string;
  vin?: string;
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
      setMsg("You're the top bidder!");
    } catch {
      setMsg("Network error — try again.");
    } finally {
      setBidding(false);
    }
  }

  if (loading) {
    return (
      <>
        <main className="mx-auto w-full max-w-3xl px-5 py-10">
          <div className="h-96 w-full animate-pulse bg-foreground/[0.06]" />
        </main>
      </>
    );
  }

  if (notFound || !a) {
    return (
      <>
        <main className="mx-auto w-full max-w-3xl px-5 py-24 text-center">
          <h1 className="display text-[50px]">Not found</h1>
          <p className="mt-2 text-[14px] ">This auction doesn&apos;t exist or was removed.</p>
          <Link href="/auctions" className="util-label mt-6 inline-block  hover:brightness-110">
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
      <main className="mx-auto w-full max-w-3xl px-5 py-8">
        <Link href="/auctions" className="util-label  ">
          All auctions
        </Link>

        <div className="mt-4 rounded-card glass-card">
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <CarPhoto src={a.image} alt={a.title} />
            <span className="absolute rounded-lg left-3 top-3 flex items-center gap-1.5 bg-background/70 text-foreground px-3 py-1.5">
              {!ended && <LiveDot />}
              <span className="util-label ">{ended ? "Ended" : countdown(a.endsAt, now)}</span>
            </span>
          </div>

          <div className="p-6">
            <h1 className="display text-[34px]">{a.title}</h1>
            <p className="util-label mt-2 ">
              {a.sellerName}
              {a.year || a.make || a.model ? ` — ${[a.year, a.make, a.model].filter(Boolean).join(" ")}` : ""}
            </p>
            {/* Listings created before the VIN was required simply don't have one. */}
            {a.vin && (
              <p className="util-label mt-1 ">
                VIN <span className="font-mono tracking-wider ">{a.vin}</span>
              </p>
            )}

            {/* Current bid — giant display number */}
            <div className="mt-6 flex items-end justify-between border-y border-[var(--line-card)] py-6">
              <div>
                <div className="util-label ">{a.bidCount > 0 ? "Current bid" : "Starting bid"}</div>
                <div className="display text-[50px]  sm:text-[50px]">{money(a.currentBid)}</div>
                <div className="util-label mt-1 ">
                  {a.bidCount} bids{a.topBidderName ? ` · top ${a.topBidderName}` : ""}
                </div>
              </div>
              {!ended && (
                <div className="text-right">
                  <div className="util-label ">Ends in</div>
                  <div className="display text-[20px]">{countdown(a.endsAt, now)}</div>
                </div>
              )}
            </div>

            {/* Bidding / result */}
            {ended ? (
              <div className="mt-6">
                <ResultBox a={a} />
              </div>
            ) : a.youAreSeller ? (
              <p className="mt-6 rounded-thumb border border-[var(--line-card)] glass-chip p-4 text-[14px] ">
                This is your listing — you can&apos;t bid on it. Share the link to start a bidding war.
              </p>
            ) : (
              <div className="mt-6">
                <div className="flex gap-px rounded-thumb border border-[var(--line-card)] bg-foreground/10">
                  <div className="flex flex-1 items-center bg-background text-foreground px-3">
                    <span className="">$</span>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      inputMode="numeric"
                      placeholder={`${minNext.toLocaleString()} or more`}
                      className="w-full bg-transparent px-2 py-3.5 text-[14px]  outline-none "
                    />
                  </div>
                  <Button onClick={placeBid} disabled={bidding} className="px-6">
                    {bidding ? "Bidding…" : status !== "authenticated" ? "Sign in to bid" : "Place bid"}
                  </Button>
                </div>
                <p className="util-label mt-2 ">Minimum next bid: {money(minNext)}</p>
                {msg && <p className="mt-2 text-[14px] ">{msg}</p>}
              </div>
            )}

            {a.description && (
              <div className="mt-8 border-t border-[var(--line-card)] pt-6">
                <div className="util-label ">Description</div>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed ">{a.description}</p>
              </div>
            )}

            {a.bids.length > 0 && (
              <div className="mt-8 border-t border-[var(--line-card)] pt-6">
                <div className="util-label mb-2 ">Bid history</div>
                <DataTable
                  head={["Bidder", "Bid"]}
                  rows={a.bids.map((b) => ({ cells: [<span key="n" className="font-semibold">{b.bidderName}</span>, money(b.amount)] }))}
                />
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
      <p className="rounded-thumb border border-[var(--line-card)] glass-chip p-4 text-[14px] ">
        This auction ended with no bids.
      </p>
    );
  }
  // Winner sees the seller's contact. Seller sees who won.
  if (a.youAreWinner && a.contact) {
    return (
      <div className="bg-carz p-5 ">
        <div className="util-label">You won</div>
        <h3 className="display mt-1 text-[34px]">Won for {money(a.currentBid)}</h3>
        <p className="mt-2 text-[14px] font-medium">Contact the seller to arrange the sale:</p>
        <p className="mt-2 select-all bg-carz-ink px-3 py-2 font-mono text-[14px] ">{a.contact}</p>
      </div>
    );
  }
  if (a.youAreSeller) {
    return (
      <div className="rounded-thumb border border-[var(--line-card)] glass-chip p-5">
        <div className="util-label ">Sold</div>
        <h3 className="display mt-1 text-[20px]">Sold for {money(a.currentBid)}</h3>
        <p className="mt-2 text-[14px] ">
          Winner: <span className="font-semibold ">{a.topBidderName}</span> — they&apos;ve been shown your contact to reach out.
        </p>
        {a.contact && (
          <p className="mt-2 select-all border border-[var(--line-card)] bg-background text-foreground px-3 py-2 font-mono text-[14px] ">
            Your contact: {a.contact}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-thumb border border-[var(--line-card)] glass-chip p-5">
      <h3 className="display text-[20px]">Won by {a.topBidderName}</h3>
      <p className="mt-1 text-[14px] ">Final bid {money(a.currentBid)}. The winner gets the seller&apos;s contact.</p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button, CarPhoto, LiveDot, Skeleton } from "@/components/ui/editorial";

/* Hero filter bar — routes on submit. */
export function HomeFilterBar() {
  const router = useRouter();
  return (
    <FilterBar
      tabs={["Make", "Model", "Near me"]}
      placeholder="Search a make, model, or spot near you…"
      submitLabel="Go"
      onSubmit={(tab) => router.push(tab === "Near me" ? "/spot" : "/auctions")}
    />
  );
}

type Auction = {
  id: string;
  title: string;
  year: string;
  make: string;
  model: string;
  image: string;
  currentBid: number;
  bidCount: number;
  endsAt: number;
  ended: boolean;
};

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function left(endsAt: number): string {
  const d = endsAt - Date.now();
  if (d <= 0) return "Ended";
  const days = Math.floor(d / 86_400_000);
  const h = Math.floor((d % 86_400_000) / 3_600_000);
  const m = Math.floor((d % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

/* Live auctions strip — pulls real listings, falls back to an invite. */
export function LiveAuctions() {
  const [items, setItems] = useState<Auction[] | null>(null);

  useEffect(() => {
    fetch("/api/auctions", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d.auctions) ? d.auctions.filter((a: Auction) => !a.ended).slice(0, 4) : []))
      .catch(() => setItems([]));
  }, []);

  if (items === null) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-black p-4">
            <Skeleton className="aspect-[4/3] w-full" />
            <Skeleton className="mt-3 h-4 w-2/3" />
            <Skeleton className="mt-2 h-6 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border border-white/10 bg-card p-10 text-center">
        <p className="util-label text-white/50">No live auctions right now</p>
        <p className="mt-2 text-sm text-white/70">Be the first — list a car and start a bidding war.</p>
        <Button href="/auctions/new" className="mt-5">
          List your car
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((a) => (
        <Link key={a.id} href={`/auctions/${a.id}`} className="group flex flex-col bg-black p-4">
          <div className="aspect-[4/3] w-full overflow-hidden">
            <CarPhoto src={a.image} alt={a.title} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <LiveDot />
            <span className="util-label text-white/45">{left(a.endsAt)}</span>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-white">{a.title}</p>
          <div className="mt-1 flex items-end justify-between">
            <span className="display text-2xl text-carz">{money(a.currentBid)}</span>
            <span className="util-label text-white/40">{a.bidCount} bids</span>
          </div>
          <span className="mt-3 inline-flex justify-center border border-white/40 px-4 py-2 util-label text-white transition-colors group-hover:border-carz group-hover:bg-carz group-hover:text-carz-ink">
            Bid now
          </span>
        </Link>
      ))}
    </div>
  );
}

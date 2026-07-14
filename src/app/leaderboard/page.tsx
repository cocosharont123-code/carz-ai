"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

type RareCar = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  rarityScore: number;
  rarityReason?: string;
  priceRange?: string;
  image?: string;
  spotter: string;
  ts: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

function rarityLabel(s: number): string {
  return s >= 85 ? "Extremely rare" : s >= 70 ? "Rare" : s >= 45 ? "Uncommon" : "Common";
}

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [cars, setCars] = useState<RareCar[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured !== false);
        setCars(Array.isArray(d.cars) ? d.cars : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <h1 className="text-3xl font-extrabold tracking-tight">🏆 Rarest Cars Spotted</h1>
        <p className="mt-1 text-muted-foreground">
          The rarest cars identified across everyone using Carz AI.
        </p>

        {loading ? (
          <div className="mt-6 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-foreground/[0.04]" />
            ))}
          </div>
        ) : !configured ? (
          <div className="mt-6 rounded-3xl border border-sky-500/40 bg-sky-500/10 p-6 text-center">
            <h3 className="text-lg font-bold">Leaderboard is warming up</h3>
            <p className="mt-1 text-sm text-muted-foreground">Check back in a moment.</p>
          </div>
        ) : cars.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-foreground/[0.06] bg-card p-8 text-center backdrop-blur-xl">
            <div className="text-4xl">🏁</div>
            <h3 className="mt-3 text-lg font-bold">No cars on the board yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Be the first — spot a rare car and it&apos;ll land here.
            </p>
            <Link
              href="/spot"
              className="mt-4 inline-block rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-5 py-2.5 font-semibold text-white"
            >
              Spot a car
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-2.5">
            {cars.map((c, i) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 rounded-2xl border p-3 backdrop-blur-xl ${
                  i === 0
                    ? "border-amber-400/40 bg-amber-400/[0.06]"
                    : "border-foreground/[0.06] bg-card"
                }`}
              >
                <div className="w-8 shrink-0 text-center text-lg font-extrabold">
                  {MEDALS[i] ?? <span className="text-muted-foreground">{i + 1}</span>}
                </div>
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-foreground/[0.04]">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt={`${c.make} ${c.model}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">🚗</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">
                    {c.make} {c.model}
                    {c.yearRange ? <span className="font-normal text-muted-foreground"> · {c.yearRange}</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Spotted by {c.spotter}
                    {c.priceRange ? ` · ${c.priceRange}` : ""}
                  </p>
                  {c.rarityReason ? (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{c.rarityReason}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-extrabold text-amber-300">{Math.round(c.rarityScore)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {rarityLabel(c.rarityScore)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

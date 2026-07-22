"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Avatar } from "@/components/default-avatar";
import { Button, PageMasthead, CarPhoto, Skeleton, Eyebrow } from "@/components/ui/editorial";
import { cn } from "@/lib/utils";

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
  spotterImage?: string;
  ts: number;
};

function rarityLabel(s: number): string {
  return s >= 100 ? "Ultra rare" : s >= 85 ? "Extremely rare" : s >= 70 ? "Rare" : s >= 45 ? "Uncommon" : "Common";
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
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <PageMasthead eyebrow="The board" title="Rarest Cars" count={loading ? "—" : `${cars.length} logged`} />

        {loading ? (
          <div className="mt-6 space-y-px">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !configured ? (
          <div className="mt-8 border border-white/10 bg-card p-8 text-center">
            <Eyebrow yellow className="justify-center">Warming up</Eyebrow>
            <p className="mt-2 text-sm text-white/60">The board is connecting its database. Check back in a moment.</p>
          </div>
        ) : cars.length === 0 ? (
          <div className="mt-8 border border-white/10 bg-card p-10 text-center">
            <h3 className="display text-3xl">No cars yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
              The board is empty. Spot a rare car and claim the top slot.
            </p>
            <Button href="/spot" className="mt-6">Spot a car</Button>
          </div>
        ) : (
          <div className="mt-6 border border-white/10">
            {/* header */}
            <div className="hidden grid-cols-[3rem_5rem_1fr_5rem] items-center gap-3 border-b border-white/15 px-4 py-2.5 sm:grid">
              <span className="util-label text-white/40">#</span>
              <span className="util-label text-white/40">Car</span>
              <span className="util-label text-white/40">Spotter</span>
              <span className="util-label text-right text-white/40">Rarity</span>
            </div>
            {cars.map((c, i) => {
              const ultra = c.rarityScore >= 100;
              const top = i < 3;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group grid grid-cols-[2.5rem_4rem_1fr_auto] items-center gap-3 border-b border-white/10 px-4 sm:grid-cols-[3rem_5rem_1fr_5rem]",
                    ultra ? "bg-carz text-carz-ink" : "text-white/85",
                    top ? "py-4" : "py-3",
                  )}
                >
                  <span className={cn("display", top ? "text-3xl" : "text-2xl", ultra ? "text-carz-ink" : "text-white")}>
                    {i + 1}
                  </span>
                  <div className={cn("overflow-hidden", top ? "h-14 w-16" : "h-12 w-14")}>
                    <CarPhoto src={c.image} alt={`${c.make} ${c.model}`} className="h-full w-full" />
                  </div>
                  <div className="min-w-0">
                    <p className={cn("truncate font-semibold", top && "text-lg")}>
                      {c.make} {c.model}
                      {c.yearRange ? <span className={cn("font-normal", ultra ? "text-carz-ink/60" : "text-white/45")}> · {c.yearRange}</span> : null}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs">
                      <Avatar src={c.spotterImage} size={15} />
                      <span className={cn("truncate", ultra ? "text-carz-ink/70" : "text-white/45")}>{c.spotter}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={cn("display", top ? "text-3xl" : "text-2xl")}>{Math.round(c.rarityScore)}</div>
                    <div className={cn("util-label", ultra ? "text-carz-ink/60" : "text-white/40")}>{rarityLabel(c.rarityScore)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

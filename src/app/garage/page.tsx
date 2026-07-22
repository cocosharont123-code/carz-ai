"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { getGarage, removeFromGarage, clearGarage, type GarageCar } from "@/lib/garage-local";
import { Button, PageMasthead, StatRow, CarPhoto, Skeleton } from "@/components/ui/editorial";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function GaragePage() {
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState<GarageCar[]>([]);

  useEffect(() => {
    setCars(getGarage());
    setLoading(false);
  }, []);

  function remove(id: string) {
    setCars(removeFromGarage(id));
  }

  function clearAll() {
    if (window.confirm("Clear your entire spotting history? This can't be undone.")) {
      clearGarage();
      setCars([]);
    }
  }

  const uniqueModels = new Set(cars.map((c) => `${c.make} ${c.model}`.trim())).size;
  const rarest = cars.reduce<GarageCar | null>((best, c) => (!best || c.rarityScore > best.rarityScore ? c : best), null);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-10">
        <PageMasthead
          eyebrow="Your history · on this device"
          title="Garage"
          count={loading ? "—" : `${cars.length} spotted`}
          action={
            cars.length > 0 ? (
              <button onClick={clearAll} className="util-label  ">
                Clear all
              </button>
            ) : null
          }
        />

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-card text-card-foreground">
                <Skeleton className="aspect-square w-full" />
              </div>
            ))}
          </div>
        ) : cars.length === 0 ? (
          <div className="mt-8 border border-white/10 bg-card text-card-foreground p-10 text-center">
            <h3 className="display text-3xl">Garage empty</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm ">
              No spots yet. Identify a car and it lands here automatically.
            </p>
            <Button href="/spot" className="mt-6">Spot a car</Button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <StatRow value={cars.length} label="Spotted" className="p-4 sm:p-6" />
              <StatRow value={uniqueModels} label="Unique models" yellow className="p-4 sm:p-6" />
              <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-card text-card-foreground p-4 sm:p-6">
                <div className="display truncate text-2xl sm:text-3xl">
                  {rarest && rarest.rarityScore > 0 ? `${rarest.make} ${rarest.model}` : "—"}
                </div>
                <div className="util-label mt-2 ">Rarest find</div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {cars.map((c) => (
                <div key={c.id} className="reveal press lift group relative overflow-hidden rounded-2xl border border-white/10 bg-card text-card-foreground">
                  <button
                    onClick={() => remove(c.id)}
                    title="Remove"
                    className="absolute right-2 top-2 z-10 hidden h-6 w-6 items-center justify-center bg-black/70 text-white text-xs  group-hover:flex hover:bg-carz "
                  >
                    ✕
                  </button>
                  <div className="relative aspect-square w-full overflow-hidden">
                    <CarPhoto src={c.image} alt={`${c.make} ${c.model}`} />
                    {c.rarityScore >= 70 && (
                      <span className="absolute left-2 top-2 bg-carz px-1.5 py-0.5 util-label ">Rare</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold ">{c.make} {c.model}</p>
                    <p className="util-label mt-1 truncate ">
                      {c.yearRange}
                      {c.priceRange ? ` · ${c.priceRange}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] ">{fmtDate(c.ts)}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 util-label text-center ">Saved on this device only — not uploaded.</p>
          </>
        )}
      </main>
    </>
  );
}

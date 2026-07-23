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
  const [member, setMember] = useState<boolean | null>(null);

  useEffect(() => {
    setCars(getGarage());
    setLoading(false);
    fetch("/api/membership", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMember(!!d.member))
      .catch(() => setMember(false));
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

  // Garage is a Carz+ member perk.
  if (member === false) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-lg px-5 py-16 text-center">
          <div className="rounded-3xl border border-white/12 bg-card text-card-foreground p-10">
            <div className="text-4xl">🏠</div>
            <h1 className="display mt-3 text-3xl">Garage is members-only</h1>
            <p className="mx-auto mt-2 max-w-sm text-[13px] opacity-70">
              Your full spotting history lives in the Garage — a Carz+ perk. Join to unlock it.
            </p>
            <Button href="/membership" className="mt-6">Get Carz+ · $9.99/mo</Button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-10">
        <PageMasthead
          eyebrow="Your history · members only"
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

        {loading || member === null ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-card text-card-foreground">
                <Skeleton className="aspect-square w-full" />
              </div>
            ))}
          </div>
        ) : cars.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-10 text-center">
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
                    className="absolute rounded-lg right-2 top-2 z-10 hidden h-6 w-6 items-center justify-center bg-black/70 text-white text-xs  group-hover:flex hover:bg-carz "
                  >
                    ✕
                  </button>
                  <div className="relative aspect-square w-full overflow-hidden">
                    <CarPhoto src={c.image} alt={`${c.make} ${c.model}`} />
                    {c.rarityScore >= 70 && (
                      <span className="absolute left-2 top-2 rounded-md bg-carz px-1.5 py-0.5 util-label ">Rare</span>
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

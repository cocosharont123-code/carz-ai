"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getGarage, removeFromGarage, clearGarage, type GarageCar } from "@/lib/garage-local";

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
  const rarest = cars.reduce<GarageCar | null>(
    (best, c) => (!best || c.rarityScore > best.rarityScore ? c : best),
    null,
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">🏠 My Garage</h1>
            <p className="mt-1 text-muted-foreground">
              Every car you&apos;ve spotted, saved right here on your device.
            </p>
          </div>
          {cars.length > 0 && (
            <button
              onClick={clearAll}
              className="mt-1 shrink-0 rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-muted-foreground hover:border-rose-500/40 hover:text-rose-300"
            >
              Clear all
            </button>
          )}
        </div>

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-foreground/[0.04]" />
            ))}
          </div>
        ) : cars.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-foreground/[0.06] bg-card p-8 text-center backdrop-blur-xl">
            <div className="text-4xl">🚘</div>
            <h3 className="mt-3 text-lg font-bold">Your garage is empty</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Identify a car and it&apos;ll show up here automatically.
            </p>
            <Link
              href="/spot"
              className="mt-4 inline-block rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-5 py-2.5 font-semibold text-white"
            >
              Spot a car
            </Link>
          </div>
        ) : (
          <>
            {/* stats */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-foreground/[0.04] p-4 text-center">
                <div className="text-2xl font-extrabold">{cars.length}</div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">spotted</div>
              </div>
              <div className="rounded-2xl bg-foreground/[0.04] p-4 text-center">
                <div className="text-2xl font-extrabold">{uniqueModels}</div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">unique models</div>
              </div>
              <div className="rounded-2xl bg-foreground/[0.04] p-4 text-center">
                <div className="truncate text-sm font-bold">
                  {rarest && rarest.rarityScore > 0 ? `${rarest.make} ${rarest.model}` : "—"}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">rarest find</div>
              </div>
            </div>

            {/* grid */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cars.map((c) => (
                <div key={c.id} className="group relative overflow-hidden rounded-2xl border border-foreground/[0.06] bg-card">
                  <button
                    onClick={() => remove(c.id)}
                    title="Remove"
                    className="absolute right-1.5 top-1.5 z-10 hidden h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex hover:bg-rose-500/80"
                  >
                    ✕
                  </button>
                  <div className="relative aspect-square w-full bg-foreground/[0.04]">
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt={`${c.make} ${c.model}`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl">🚗</div>
                    )}
                    {c.rarityScore >= 70 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-black">
                        RARE
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-bold">
                      {c.make} {c.model}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.yearRange}
                      {c.priceRange ? ` · ${c.priceRange}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDate(c.ts)}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Saved on this device only — not uploaded anywhere.
            </p>
          </>
        )}
      </main>
    </>
  );
}

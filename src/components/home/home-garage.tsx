"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CarPhoto } from "@/components/ui/editorial";
import { getGarage, type GarageCar } from "@/lib/garage-local";

/** Enough to show the collection exists without turning the homepage into it. */
const SHOWN = 6;

/**
 * The garage, on the homepage.
 *
 * Reads the same localStorage the garage page does — there is no server copy;
 * a saved car lives on the device that spotted it. So this is a client
 * component and renders nothing at all on the server, which also keeps the
 * markup identical on both sides of hydration.
 *
 * Nothing is shown when the garage is empty. A homepage is not the place for an
 * empty state telling you about a feature you have not used; the tiles above
 * already say the app can do this.
 */
export function HomeGarage() {
  const [cars, setCars] = useState<GarageCar[] | null>(null);

  useEffect(() => {
    // Deferred a microtask: localStorage is the external system being read
    // from, and a synchronous state write in an effect body cascades renders.
    let cancelled = false;
    Promise.resolve()
      .then(() => getGarage())
      .then((saved) => {
        if (!cancelled) setCars(saved);
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!cars || cars.length === 0) return null;

  return (
    <section className="mt-10">
      <Link
        href="/garage"
        className="press flex min-h-11 items-center justify-between gap-3"
      >
        <span className="util-label opacity-60">
          Your garage · {cars.length} saved
        </span>
        <span className="flex items-center gap-1 text-[13px] font-semibold opacity-70">
          Open
          <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
      </Link>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {cars.slice(0, SHOWN).map((c) => (
          <Link
            key={c.id}
            href="/garage"
            aria-label={`${c.make} ${c.model} in your garage`}
            className="press group relative aspect-square overflow-hidden rounded-xl bg-white/[0.04]"
          >
            <CarPhoto
              src={c.image}
              alt={`${c.make} ${c.model}`}
              color
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
            />
            {/* The name rides on the photo behind a scrim, the way the garage
                itself does, so a pale car cannot wash it out. */}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-bold text-white">
              {c.make} {c.model}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

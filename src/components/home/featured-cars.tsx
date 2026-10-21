"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Car } from "lucide-react";
import { getGarage, type GarageCar } from "@/lib/garage-local";

/**
 * Featured Cars: the viewer's own spots, with the photo they actually took.
 *
 * This was a hardcoded list -- Revuelto, GT3 RS, SF90 -- pointing at stock
 * photos that are not in this repo, which is why no picture ever loaded. There
 * was nothing to load. Real spots come with a real photograph attached, so the
 * strip now shows cars this person scanned and saved, each with the frame from
 * that scan.
 *
 * Read from the garage, which is localStorage on this device, so this is a
 * client island. Nothing is server-rendered here because the server has never
 * seen anyone's garage.
 *
 * Newest first: the strip is "what you have been spotting", and a collection
 * ordered oldest-first opens on the thing you care least about.
 */
export function FeaturedCars() {
  const [cars, setCars] = useState<GarageCar[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred a microtask: localStorage is the external system being read, and
    // a synchronous state write in an effect body cascades renders.
    Promise.resolve()
      .then(() => getGarage())
      .then((g) => {
        if (!cancelled) setCars(g.filter((c) => !!c.image).sort((a, b) => b.ts - a.ts));
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A fixed-height rail either way, so the sections below it do not jump when
  // the garage finishes reading.
  if (cars === null) {
    return <div aria-hidden className="h-[105px]" />;
  }

  if (cars.length === 0) {
    return (
      <Link
        href="/spot"
        className="press glass-card flex h-[105px] items-center gap-3 rounded-thumb px-4"
      >
        <Car className="h-6 w-6 shrink-0 text-[var(--color-muted-text)]" strokeWidth={1.5} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">
            Scan your first car
          </span>
          <span className="block text-[13px] text-[var(--color-secondary-text)]">
            Cars you save show up here
          </span>
        </span>
        <ChevronRight
          className="h-[18px] w-[18px] shrink-0 text-[var(--color-muted-text)]"
          strokeWidth={1.75}
          aria-hidden
        />
      </Link>
    );
  }

  return (
    <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {cars.map((c) => (
        <Link
          key={c.id}
          href="/garage"
          aria-label={`${c.make} ${c.model} in your garage`}
          // Three across, measured from the column rather than the window: the
          // app is capped at 480px on a desktop, so 100vw alone would size
          // these for a monitor and show one and a half.
          // §2: a repeated item in a scroller, so lite.
          className="press glass-lite w-[calc((min(100vw,480px)-64px)/3)] shrink-0 snap-start overflow-hidden rounded-thumb"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.image}
            alt=""
            className="h-[68px] w-full object-cover"
            loading="lazy"
            draggable={false}
          />
          <span className="flex items-center gap-1 px-2 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-tight text-foreground">
                {c.make}
              </span>
              <span className="block truncate text-[13px] font-bold leading-tight text-foreground">
                {c.model}
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[var(--color-muted-text)]"
              strokeWidth={1.75}
              aria-hidden
            />
          </span>
        </Link>
      ))}
    </div>
  );
}

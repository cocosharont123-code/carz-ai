"use client";

import { useEffect, useState } from "react";

/**
 * The leaderboard's top entries, fetched once for the whole screen.
 *
 * One caller today -- the podium -- and it was two: the rest of the board was
 * a section further down the page, and the request is shared so that the two
 * could not disagree about who was winning. That section is gone, and this
 * stays as it is: a module-level promise is the right shape for a page-wide
 * read whether one component or three are asking, and it is what keeps a
 * remount from spending another request.
 */

export type TopCar = {
  id: string;
  make: string;
  model: string;
  rarityScore: number;
  image?: string;
};

let pending: Promise<TopCar[]> | null = null;

function load(): Promise<TopCar[]> {
  if (pending) return pending;
  pending = fetch("/api/leaderboard", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { cars: [] }))
    .then((d) => {
      const list: TopCar[] = Array.isArray(d?.cars) ? d.cars : [];
      // Sorted here rather than trusted: the board writes in its own order,
      // and a podium out of rank order is a bug anyone can see.
      return list
        .filter((c) => c && c.make && (Number(c.rarityScore) || 0) > 0)
        .sort((a, b) => (Number(b.rarityScore) || 0) - (Number(a.rarityScore) || 0))
        // Three is all Home draws now. The slice is here rather than at the
        // caller so the shared promise holds one answer rather than one per
        // caller's appetite.
        .slice(0, 3);
    })
    .catch(() => []);
  return pending;
}

/** null while the request is in flight; an array once it has settled. */
export function useTopCars(): TopCar[] | null {
  const [cars, setCars] = useState<TopCar[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    load().then((list) => {
      if (!cancelled) setCars(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return cars;
}

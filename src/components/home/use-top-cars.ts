"use client";

import { useEffect, useState } from "react";

/**
 * The leaderboard's top entries, fetched once for the whole screen.
 *
 * Home shows the board in two places -- the podium at the top and the rest of
 * it further down -- and they are far enough apart in the layout that they
 * cannot be one component. Two components each calling /api/leaderboard would
 * be two requests for one answer, and worse, two answers: the board can be
 * written between them, which would put a car on the podium that the list
 * below disagrees about.
 *
 * So the request is module-level and shared. The promise is created on first
 * use and every later caller gets the same one, for the life of the page.
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
        .slice(0, 8);
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

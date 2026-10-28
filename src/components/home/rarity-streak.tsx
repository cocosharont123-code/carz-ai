"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { StreakBadge } from "@/components/ui/streak-badge";
import { getGarage } from "@/lib/garage-local";

/**
 * Days in a row you have spotted a car over 65 rarity.
 *
 * Read from the garage in localStorage, which is the only place that knows:
 * saved cars carry their rarity score and the moment they were saved, and the
 * server has never seen any of it. So this is a client island and there is no
 * endpoint behind it.
 */

/** Spotting something ordinary does not keep the streak alive. */
const RARITY_FLOOR = 65;

/** Local midnight, not UTC: a car saved at 11pm belongs to the day you saw it. */
function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function shiftDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Count back from today while every day has a qualifying car.
 *
 * Today not being on the board does not end the streak -- the day is not over
 * yet -- so when today is empty the count starts at yesterday. Missing
 * yesterday as well is what breaks it.
 */
export function rarityStreak(cars: { rarityScore: number; ts: number }[], now = Date.now()): number {
  const days = new Set(cars.filter((c) => c.rarityScore > RARITY_FLOOR).map((c) => dayKey(c.ts)));
  if (days.size === 0) return 0;

  const today = new Date(now);
  let cursor = days.has(dayKey(now)) ? today : shiftDays(today, -1);

  let streak = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

export function RarityStreak({ className }: { className?: string }) {
  // Null until the garage has been read. Rendering a 0 first would count down
  // to the real number in front of you, and the server cannot know it at all.
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Deferred a microtask: localStorage is the external system being read, and
    // a synchronous state write in an effect body cascades renders.
    Promise.resolve()
      .then(() => getGarage())
      .then((g) => {
        if (!cancelled) setStreak(rarityStreak(g));
      })
      .catch(() => {
        if (!cancelled) setStreak(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (streak === null) return null;

  return (
    <StreakBadge
      size="sm"
      length={streak}
      frequency="daily"
      subtitle={`${RARITY_FLOOR}+ rarity`}
      // The hero is dark whatever the theme -- a photo under a gradient that
      // runs to solid black -- so this is white on glass rather than the
      // palette's card colours, which would go near-black in light mode.
      className={className}
      icon={<Flame className="h-10 w-10 shrink-0 text-carz" strokeWidth={1.75} aria-hidden />}
    />
  );
}

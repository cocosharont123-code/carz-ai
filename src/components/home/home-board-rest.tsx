"use client";

import Link from "next/link";
import { useTopCars } from "@/components/home/use-top-cars";

/**
 * The rest of the leaderboard, further down Home.
 *
 * Ranks four and below. They were directly under the podium, inside the hero,
 * which meant the first thing on the screen was five more rows of leaderboard
 * and the search field had been pushed most of a screen down. Here they are a
 * section like Your Spots and Upcoming Events: you reach them by scrolling,
 * and until you do the top of the page is the podium and the controls that
 * were always there.
 *
 * In the page's own flow, not a scroller of its own -- §9 bans a second
 * same-axis scroller, and a list you can scroll inside a page you can scroll
 * is a coin toss on a phone over which one moves.
 *
 * Nothing at all when the board has three entries or fewer -- and that is why
 * the heading is in here rather than in a <Section> around it in page.tsx: a
 * section whose body renders null leaves a title and a "See all" hanging over
 * nothing, which looks like a list that failed to load.
 */
export function HomeBoardRest() {
  const cars = useTopCars();
  const rest = cars?.slice(3) ?? [];

  if (!cars || rest.length === 0) return null;

  return (
    <section className="mt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[21px] font-bold text-foreground">Leaderboard</h2>
        <Link
          href="/leaderboard"
          className="press text-[15px] text-[var(--color-secondary-text)]"
        >
          See all ›
        </Link>
      </div>

      <ol className="mt-3 space-y-1.5">
        {rest.map((car, i) => (
          <li key={car.id}>
            <Link
              href="/leaderboard"
              className="press glass-lite flex min-h-11 items-center gap-3 rounded-card px-3 py-2"
            >
              <span className="w-5 shrink-0 text-center text-[13px] font-bold tabular-nums text-foreground/60">
                {i + 4}
              </span>
              {car.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={car.image}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-thumb object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  aria-hidden
                  className="h-9 w-9 shrink-0 rounded-thumb bg-foreground/10"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">
                {`${car.make} ${car.model}`.trim()}
              </span>
              <span className="shrink-0 text-[14px] font-bold tabular-nums text-foreground">
                {Math.round(Number(car.rarityScore) || 0)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

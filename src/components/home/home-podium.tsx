"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LeaderboardPodium, type LeaderboardRanking } from "@/components/ui/leaderboard-podium";

/**
 * The top three on the leaderboard, at the top of Home.
 *
 * This replaces the four-line "Snap / Any car. / Know / Everything." headline.
 * The headline said what the app does; the podium shows what people have
 * actually found with it, which is the better argument and is different every
 * time you open it.
 *
 * It uses the LeaderboardPodium the app already has rather than installing a
 * second one. The two have the same props -- userId, userName, rank, value,
 * avatarUrl -- but this one is wired to the app's --color-rank tokens, and the
 * other defaults a missing avatar to pravatar.cc, which would put photographs
 * of strangers on the home screen of a car app.
 *
 * Three states, and the last one matters: while the board is loading this is a
 * fixed-height placeholder so nothing below it moves, and if the board comes
 * back empty -- a fresh deployment, nothing scanned yet -- the old headline is
 * what shows. A hole where the top of the page used to be is worse than the
 * sentence it replaced.
 */

type Car = {
  id: string;
  make: string;
  model: string;
  rarityScore: number;
  image?: string;
  spotter?: string;
};

/**
 * Only the loading state has a fixed height, and only so the page does not
 * jump when the board lands. The podium itself is left to be as tall as it
 * is: the hero grows to fit its content now, which is what stopped it being
 * clipped at the top of the search field.
 */
const LOADING_BLOCK = "h-[212px]";

export function HomePodium() {
  const [cars, setCars] = useState<Car[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { cars: [] }))
      .then((d) => {
        if (cancelled) return;
        const list: Car[] = Array.isArray(d?.cars) ? d.cars : [];
        // Sorted here rather than trusted: the board writes in its own order
        // and a podium that is not in rank order is a bug people can see.
        setCars(
          [...list]
            .filter((c) => c && c.make && (Number(c.rarityScore) || 0) > 0)
            .sort((a, b) => (Number(b.rarityScore) || 0) - (Number(a.rarityScore) || 0))
            // Three for the podium and five to scroll into. Eight is where a
            // board stops being a glance and starts being the leaderboard
            // page, which is one tap away at the end of the list.
            .slice(0, 8),
        );
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (cars === null) return <div aria-hidden className={LOADING_BLOCK} />;

  if (cars.length === 0) {
    return (
      <h1 className="text-[36px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em]">
        <span className="block text-foreground">Snap</span>
        <span className="block text-foreground">Any car.</span>
        <span className="block text-foreground/60">Know</span>
        <span className="block text-foreground/60">Everything.</span>
      </h1>
    );
  }

  const [podium, rest] = [cars.slice(0, 3), cars.slice(3)];

  const rankings: LeaderboardRanking[] = podium.map((car, i) => ({
    userId: car.id,
    userName: `${car.make} ${car.model}`.trim(),
    rank: i + 1,
    value: Math.round(Number(car.rarityScore) || 0),
    // The car's own photograph. Not the spotter's face: the board ranks cars.
    avatarUrl: car.image || undefined,
  }));

  return (
    <div>
      {/* The screen keeps a heading, and it is small on purpose -- the podium
          is the content, and §5 allows one title. */}
      <h1 className="util-label mb-2 text-foreground/60">Rarest finds</h1>
      <Link href="/leaderboard" className="press block" aria-label="See the full leaderboard">
        <LeaderboardPodium rankings={rankings} />
      </Link>

      {/* The rest of the board, under the podium.
      
          In the page's own flow rather than a scroller of its own: §9 bans a
          second same-axis scroller, and one here would mean a list you can
          scroll inside a page you can scroll, which on a phone is a coin toss
          over which one moves. Scrolling Home goes down the board, which is
          what was asked for. */}
      {rest.length > 0 && (
        <ol className="mt-5 space-y-1.5">
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
                  <span aria-hidden className="h-9 w-9 shrink-0 rounded-thumb bg-foreground/10" />
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
      )}

      <Link
        href="/leaderboard"
        className="press mt-3 flex min-h-11 items-center justify-center text-[14px] font-semibold text-foreground/70"
      >
        See the whole board ›
      </Link>
    </div>
  );
}

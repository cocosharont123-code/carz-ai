"use client";

import Link from "next/link";
import { LeaderboardPodium, type LeaderboardRanking } from "@/components/ui/leaderboard-podium";
import { useTopCars } from "@/components/home/use-top-cars";
import { useSplashHold } from "@/components/splash-hold";

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
 *
 * The top three only. Ranks four and below are a section further down the
 * page (HomeBoardRest), so the hero stays the height of a hero and the rest
 * of the board is something you scroll to rather than something sitting
 * between the podium and the search field.
 */

/**
 * Only the loading state has a fixed height, and only so the page does not
 * jump when the board lands. The podium itself is left to be as tall as it
 * is: the hero grows to fit its content now, which is what stopped it being
 * clipped at the top of the search field.
 */
const LOADING_BLOCK = "h-[212px]";

export function HomePodium() {
  const cars = useTopCars();

  /**
   * Hold the launch splash until the board is in.
   *
   * This is the top of the screen the app lands on, and it is the one thing
   * above the fold that arrives over the network -- lifting the splash before
   * it would reveal the placeholder block below and then swap a podium into
   * it a moment later, which is the pop-in the splash exists to prevent.
   *
   * Only the first open pays for it: the splash is gone after that, and the
   * hold is a no-op nobody sees. Its own hard cap lives in the splash, so a
   * board that never answers delays the app by seconds, not for ever.
   */
  useSplashHold(cars === null);

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

  const rankings: LeaderboardRanking[] = cars.slice(0, 3).map((car, i) => ({
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

    </div>
  );
}

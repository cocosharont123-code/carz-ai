import Link from "next/link";
import { EXPLORE_BUBBLES } from "@/config/explore";
import { HomeGarage } from "@/components/home/home-garage";

/**
 * The launch homepage.
 *
 * Everything it says about the app comes from config the app itself uses: the
 * tiles are the same EXPLORE_BUBBLES the menu renders, so a marketing page
 * cannot quietly start advertising something the product no longer does.
 *
 * What it does not carry is anything the bottom nav already does. Spot, Feed,
 * Garage and Leaderboard are one tap away from every screen in the app, and a
 * grid repeating them was a menu for a menu.
 */
/**
 * Destinations the bottom nav already carries.
 *
 * They are dropped from this grid rather than from EXPLORE_BUBBLES, which the
 * nav's own menu renders from the same list — removing them there would take
 * them out of the menu too. Matched on href rather than label so a rename
 * cannot quietly put one back.
 */
const ON_THE_NAV = new Set(["/spot", "/feed", "/garage", "/leaderboard"]);

export default function Home() {
  return (
    // pb-2, not pb-24. That 6rem was written when the nav was at the top of
    // the screen and the page had to end well clear of the bottom on its own.
    // The nav is at the bottom now and renders its own spacer, --nav-h, so a
    // page that also pads for it is padding twice — which is the scroll past
    // the end of the Carz MAX card.
    <main className="mx-auto w-full max-w-5xl px-5 pb-2 pt-10">
      {/* Hero. The headline and nothing else — the release eyebrow and the
          paragraph under it are gone, so the tiles come straight off the type
          rather than sitting two blocks below it. */}
      <section className="text-center">
        <h1 className="display text-6xl leading-[0.95] sm:text-7xl md:text-8xl">
          Snap any car.
          <br />
          Know everything.
        </h1>
      </section>

      {/* What it does — the app's own feature list, not a second copy of it. */}
      <section className="mt-8 sm:mt-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EXPLORE_BUBBLES.filter((item) => !ON_THE_NAV.has(item.href)).map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="press glass-card flex flex-col gap-2 rounded-2xl p-4"
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="text-[13px] font-semibold leading-tight">{item.label}</span>
                <span className="text-[11px] leading-snug opacity-60">{item.description}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* The cars already saved, under the things the app can do. Renders
          nothing when the garage is empty. */}
      <HomeGarage />
    </main>
  );
}

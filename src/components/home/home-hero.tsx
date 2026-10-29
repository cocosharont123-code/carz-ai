import { RarityStreak } from "@/components/home/rarity-streak";

/**
 * The home hero: photo, headline, and the rarity streak.
 *
 * A server component with no state. It used to be a client island because the
 * background was customizable -- you picked a garage photo, it saved to your
 * profile, and the picker previewed it live. That is gone, so there is nothing
 * left here to hydrate.
 *
 * The background is a plain CSS background-image rather than next/image. There
 * is no JS on this component to hide a broken-image frame with, and a CSS
 * background that resolves to nothing simply does not paint: until the asset
 * exists the hero is flat near-black, which is what the headline is designed
 * to sit on anyway.
 */

/** Optional. Drop the file in /public and it appears; until then, flat #0a0a0a. */
const HERO_PHOTO = "/home-hero-default.jpg";

export function HomeHero() {
  return (
    <section
      className="relative -mx-5 h-[45%] min-h-[220px] overflow-hidden bg-[#0a0a0a] bg-cover bg-center"
      style={{ backgroundImage: `url(${HERO_PHOTO})` }}
    >
      {/* Two overlays, not one. The top is a short scrim so the streak badge
          reads against a bright photo; the bottom runs all the way to solid
          #000 so the headline sits on black and the section joins the page
          with no seam. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-black/55 to-black" />

      {/* Beside the headline and level with the bottom of it.

          A flex row, so the two cannot overlap by construction -- they are
          separate boxes the browser lays out next to each other, not a
          positioned badge hoping to clear the text underneath it.

          For that to fit, the badge has to stop being a fixed 112px column.
          "Everything." measures 195px at 36px extrabold, and a 360px phone
          leaves 196px beside a 112px badge -- one pixel, which is a collision
          waiting for a slightly wider font. w-auto makes it hug its contents
          instead: the 40px flame plus padding is about 82px, which leaves the
          headline 226px on that same phone. Thirty-one pixels of clearance
          rather than one. */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-5 pb-5">
        <h1 className="min-w-0 text-[36px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em]">
          <span className="block text-white">Snap</span>
          <span className="block text-white">Any car.</span>
          <span className="block text-white/60">Know</span>
          <span className="block text-white/60">Everything.</span>
        </h1>

        <RarityStreak className="glass-card on-media w-auto shrink-0" />
      </div>
    </section>
  );
}

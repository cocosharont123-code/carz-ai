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
      className="relative -mx-5 h-[45vh] min-h-[320px] overflow-hidden bg-[#0a0a0a] bg-cover bg-center"
      style={{ backgroundImage: `url(${HERO_PHOTO})` }}
    >
      {/* Two overlays, not one. The top is a short scrim so the streak badge
          reads against a bright photo; the bottom runs all the way to solid
          #000 so the headline sits on black and the section joins the page
          with no seam. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-black/55 to-black" />

      {/* Top right, where the profile button used to be.

          It was beside the headline, and it did not fit: "Everything." is
          195px at 36px extrabold and a 360px phone leaves 196px next to a
          112px badge. One pixel is not clearance, it is a collision waiting
          for a slightly wider font, so the badge is out of the headline's
          column entirely. */}
      <RarityStreak className="glass-card on-media absolute right-5 top-4 z-10" />

      <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
        <h1 className="text-[36px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em]">
          <span className="block text-white">Snap</span>
          <span className="block text-white">Any car.</span>
          <span className="block text-white/60">Know</span>
          <span className="block text-white/60">Everything.</span>
        </h1>
      </div>
    </section>
  );
}

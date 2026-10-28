import Link from "next/link";
import { User } from "lucide-react";
import { RarityStreak } from "@/components/home/rarity-streak";

/**
 * The home hero: photo, headline, and the way into your profile.
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
      {/* Two overlays, not one. The top is a short scrim so the profile button
          reads against a bright photo; the bottom runs all the way to solid
          #000 so the headline sits on black and the section joins the page
          with no seam. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-black/55 to-black" />

      {/* No wordmark. It sat directly over the headline and the headline is the
          thing to read. justify-end keeps the profile button where it was. */}
      <header className="absolute inset-x-0 top-0 flex items-start justify-end px-5 pt-4">
        <Link
          href="/profile"
          aria-label="Your profile"
          className="press flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/[0.06] backdrop-blur-md"
        >
          <User className="h-[18px] w-[18px] text-white" strokeWidth={1.75} aria-hidden />
        </Link>
      </header>

      {/* The block is anchored to the bottom, so it grows upward: the streak
          appears above the headline once the garage has been read and the
          headline itself does not move. */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
        <RarityStreak className="mb-4 border-white/20 bg-white/[0.08] text-white backdrop-blur-md" />

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

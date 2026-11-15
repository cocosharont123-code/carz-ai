/**
 * The home hero: photo and headline.
 *
 * A server component with no state. It used to be a client island because the
 * background was customizable -- you picked a garage photo, it saved to your
 * profile, and the picker previewed it live. That is gone, so there is nothing
 * left here to hydrate.
 *
 * The background is a plain CSS background-image rather than next/image. There
 * is no JS on this component to hide a broken-image frame with, and a CSS
 * background that resolves to nothing simply does not paint: until the asset
 * exists the hero is the page's own background colour.
 *
 * Which is the fix here. Every surface in this component was a literal --
 * #0a0a0a behind it, black scrims over it, white type on top -- so in light
 * mode the top third of Home was a black panel with white text sitting above a
 * white page. It is all tokens now: the panel is --background, the scrims fade
 * to --background, and the headline is --foreground. Dark mode is unchanged to
 * the pixel, because in dark those tokens *are* the literals it used to use.
 *
 * The scrims still earn their place once a photo exists: they are what keeps
 * the headline readable over it, and fading to the page colour is what joins
 * the section to the page with no seam -- in either theme.
 */

/** Optional. Drop the file in /public and it appears; until then, the page colour. */
const HERO_PHOTO = "/home-hero-default.jpg";

export function HomeHero() {
  return (
    <section
      className="relative -mx-5 h-[30%] min-h-[200px] overflow-hidden bg-background bg-cover bg-center"
      style={{ backgroundImage: `url(${HERO_PHOTO})` }}
    >
      {/* Two overlays, not one. The top is a short scrim for anything laid
          over a bright photo; the bottom runs all the way to the page colour,
          so the headline sits on a solid surface and the section joins the
          page with no seam. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background/60 to-transparent" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-background/55 to-background" />

      <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
        <h1 className="text-[36px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em]">
          <span className="block text-foreground">Snap</span>
          <span className="block text-foreground">Any car.</span>
          <span className="block text-foreground/60">Know</span>
          <span className="block text-foreground/60">Everything.</span>
        </h1>
      </div>
    </section>
  );
}

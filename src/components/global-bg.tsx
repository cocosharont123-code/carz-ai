"use client";

import { GradientBars } from "@/components/ui/gradient-bars-background";

/**
 * The app's background: a row of gradient bars that breathe, fixed behind every
 * page.
 *
 * This replaces the neon RGB WebGL shader that used to sit here, and the swap is
 * worth more than the look. A fragment shader ran every frame on every screen,
 * and a browser only grants a handful of WebGL contexts: the one here competed
 * with the camera and the map for them, which is why this component used to
 * unmount itself whenever the camera opened. Nine composited divs need no
 * context at all, so nothing has to be taken away to make room, and the
 * background no longer blinks out when you go to spot a car.
 *
 * The bars are painted with --color-carz itself, which is the same token the
 * Spot disc on the nav uses -- not a copy of #00e5ff. A hex here would be a
 * second place the accent lives, and the two would drift the first time one of
 * them was retuned.
 *
 * Seven seconds a cycle, against the component's default of two. A background is
 * ambient; at two seconds it reads as something loading, and anything that looks
 * like progress behind static content is a thing people wait on.
 *
 * Everything here stays a sibling of the content wrapper and never an ancestor
 * of it: no text ends up inside a translucent or transformed layer, so glyphs
 * keep their subpixel antialiasing instead of being resampled soft.
 */
export function GlobalBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* The bars are solid at the floor and gone by the top, and the tall ones
          are at the edges — so the glow rides the left and right margins and
          leaves the column the type sits in. */}
      <GradientBars
        numBars={9}
        gradientFrom="var(--color-carz)"
        gradientTo="transparent"
        animationDuration={7}
      />
      {/* Contrast floor. This is the brightness dial, and 45% is the floor: the
          bars reach full strength along the bottom edge, and white body text on
          the cyan that comes through there measures 4.82:1, just over the 4.5:1
          AA minimum. At 35% it is 3.59:1 and fails. Everywhere above the bottom
          edge the bars are already fading out, so this is the worst case on the
          screen. */}
      <div className="absolute inset-0 bg-black/45" />
      {/* Vignette: holds the corners down, leaves the middle alone. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.32)_100%)]" />
    </div>
  );
}

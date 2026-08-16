"use client";

import { WebGLShader } from "@/components/ui/web-gl-shader";

// The homepage's neon RGB shader, mounted as a fixed background behind every page.
//
// The shader divides by a distance that crosses zero, so its bands clip at full
// white and sweep right through the column the page's text sits in. Raw, that
// leaves white type on a white-hot streak — legible for part of a cycle and not
// the rest. The scrim below sets a contrast floor so no band can ever reach the
// text at full strength.
//
// Everything here is a sibling of the content wrapper, never an ancestor of it:
// no text is inside a filtered, translucent or transformed layer, so glyphs keep
// subpixel antialiasing instead of being resampled into softness.
export function GlobalShaderBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <WebGLShader />
      {/* Flat floor. This is the brightness dial: lower percentage = brighter
          neon. Below roughly /35 the clipped bands start reaching white behind
          body text again, which is what made type look blurred. */}
      <div className="absolute inset-0 bg-black/45" />
      {/* Vignette: a light hold at the edges where the bands run brightest,
          leaving the centre near full strength. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.32)_100%)]" />
    </div>
  );
}

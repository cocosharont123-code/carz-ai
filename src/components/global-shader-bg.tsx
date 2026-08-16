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
      {/* Flat floor: caps the clipped bands to roughly a quarter strength. */}
      <div className="absolute inset-0 bg-black/75" />
      {/* Vignette: extra hold toward the edges, where the bands run brightest,
          while the centre keeps enough neon to still read as the brand. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

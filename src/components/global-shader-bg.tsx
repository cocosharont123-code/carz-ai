"use client";

import { WebGLShader } from "@/components/ui/web-gl-shader";

// The homepage's neon RGB shader, mounted as a fixed background behind every page.
export function GlobalShaderBg() {
  return (
    <div className="global-shader pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <WebGLShader />
      {/* Scrim: the shader is bright neon and moves, which is what makes body
          copy above it look soft. Knocking it back buys contrast for every
          page without dulling the colour that shows through the edges. */}
      {/* Heavier veil on a light page: white at 55% leaves the neon reading
          as a rainbow streak behind body copy, where black at 55% is texture. */}
      <div className="absolute inset-0 bg-background opacity-[0.88] dark:opacity-[0.55]" />
    </div>
  );
}

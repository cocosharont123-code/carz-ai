"use client";

import { WebGLShader } from "@/components/ui/web-gl-shader";

// The homepage's neon RGB shader, mounted as a fixed background behind every page.
export function GlobalShaderBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <WebGLShader />
      {/* Scrim: the shader is bright neon and moves, which is what makes body
          copy above it look soft. Knocking it back buys contrast for every
          page without dulling the colour that shows through the edges. */}
      <div className="absolute inset-0 bg-background/55" />
    </div>
  );
}

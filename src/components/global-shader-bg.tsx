"use client";

import { WebGLShader } from "@/components/ui/web-gl-shader";

// The homepage's neon RGB shader, mounted as a fixed background behind every page.
export function GlobalShaderBg() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <WebGLShader />
    </div>
  );
}

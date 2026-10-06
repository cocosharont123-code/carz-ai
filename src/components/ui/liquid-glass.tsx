"use client";

import React from "react";

/**
 * The layered glass material, and the SVG filter that bends what is behind it.
 *
 * Supplied as a macOS dock of remote PNG app icons on a scrolling wallpaper.
 * What is kept is the material: a blurred and displaced backdrop, a fill, and a
 * pair of inset highlights that read as a bevelled edge. What is dropped is the
 * demo -- the icons were Finder, Safari and Steam, which are not this app's
 * tabs, and the wallpaper and the 21st.dev CDN images with them.
 *
 * Two changes the material itself needed.
 *
 * The fill was rgba(255,255,255,0.25) -- pale glass. Over anything bright that
 * leaves white content on near-white, which is the exact failure this app's
 * glass was rebuilt to avoid. It uses the app's own --glass-fill, which darkens
 * in dark mode and lightens in light, so it cannot lose contrast with whatever
 * sits on it.
 *
 * And the displacement scale drops from 200 to 40. At 200 the backdrop smears
 * several centimetres, which on a bar fixed over a scrolling page reads as a
 * rendering fault rather than as glass -- and it was expensive enough on iOS
 * that an earlier version of this filter was removed from the nav for it.
 */

export function GlassFilter({ scale = 40 }: { scale?: number }) {
  return (
    <svg aria-hidden className="pointer-events-none absolute h-0 w-0">
      <filter
        id="glass-distortion"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.001 0.005"
          numOctaves="1"
          seed="17"
          result="turbulence"
        />
        <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softMap"
          scale={scale}
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </svg>
  );
}

/**
 * A pane of the material. Children sit above every layer.
 *
 * The specular lighting pass from the original is gone: it lit the distortion
 * map with a white point light, which on a monochrome app just washed the
 * middle of the pane out. The inset highlights do that job and cost nothing.
 */
export function GlassPane({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`relative isolate overflow-hidden ${className}`} style={style}>
      {/* Blurred and displaced backdrop. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-[inherit]"
        style={{
          backdropFilter: "blur(14px) saturate(170%)",
          WebkitBackdropFilter: "blur(14px) saturate(170%)",
          filter: "url(#glass-distortion)",
        }}
      />
      {/* The fill that guarantees contrast. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-[inherit]"
        style={{ background: "var(--glass-fill)" }}
      />
      {/* The bevel. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow:
            "inset 1.5px 1.5px 1px 0 var(--glass-rim-hi), inset -1px -1px 1px 1px var(--glass-rim-lo)",
        }}
      />
      {/* Explicitly above every layer. The bevel above is positioned and the
          children are not, which in paint order puts the glass over the
          content unless the content is given a layer of its own. */}
      <div className="relative z-10 flex w-full">{children}</div>
    </div>
  );
}

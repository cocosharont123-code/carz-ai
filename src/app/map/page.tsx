"use client";

import { SpotMap } from "@/components/map/spot-map";

/**
 * The map, full screen.
 *
 * The whole viewport, with the column's own furniture given back by negative
 * margins, because a map in a padded box under a heading is a picture of a map.
 * The nav bubble and the back arrow float over it; nothing else does.
 */
export default function MapPage() {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        // Fills what is left between the notch and the tab bar. It used to be
        // a full 100dvh with the nav's spacer cancelled by a negative margin,
        // which was right while the nav was a floating bubble the map could
        // run under. The bar is solid and docked now, and Map is one of its
        // tabs, so the map stops above it instead of hiding behind it.
        height: "calc(100dvh - var(--safe-top) - var(--nav-h))",
        marginTop: "calc(-1 * var(--back-h))",
      }}
    >
      <SpotMap />
    </div>
  );
}

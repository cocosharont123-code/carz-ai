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
        height: "100dvh",
        marginTop: "calc(-1 * (var(--safe-top) + var(--back-h)))",
        marginBottom: "calc(-1 * var(--nav-h))",
      }}
    >
      <SpotMap />
    </div>
  );
}

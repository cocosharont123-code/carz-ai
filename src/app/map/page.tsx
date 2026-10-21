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
        // §4: the shell owns the height. This fills it rather than computing
        // its own from 100dvh and then subtracting the furniture -- that sum
        // was only ever an approximation of what the shell already knows, and
        // it was off by whatever the visual viewport was doing at the time.
        position: "absolute",
        inset: 0,
      }}
    >
      <SpotMap />
    </div>
  );
}

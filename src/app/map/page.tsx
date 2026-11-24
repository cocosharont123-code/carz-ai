"use client";

import { SpotMap } from "@/components/map/spot-map";

/**
 * Warm the connection before the map asks for anything.
 *
 * Measured on a throttled phone connection, the first Mapbox request does
 * not leave until 1.5s after navigation -- the page has to load and hydrate
 * before mapbox-gl exists to ask. DNS, TCP and TLS to two hosts then happen
 * on top of that, on the critical path. These start that handshake while
 * the JavaScript is still parsing, so the first tile request goes out on a
 * connection that is already open.
 *
 * React hoists them into <head>. crossOrigin because tile requests are
 * CORS: a preconnect without it opens a connection the fetches cannot use.
 */
function MapboxPreconnect() {
  return (
    <>
      <link rel="preconnect" href="https://api.mapbox.com" crossOrigin="" />
      <link rel="preconnect" href="https://events.mapbox.com" crossOrigin="" />
    </>
  );
}

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
      <MapboxPreconnect />
      <SpotMap />
    </div>
  );
}

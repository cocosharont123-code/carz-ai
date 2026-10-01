import type mapboxgl from "mapbox-gl";

/**
 * Turning a daytime satellite style into midnight.
 *
 * All of it is done at runtime against the loaded style rather than written as
 * a style JSON, and every layer is found by inspecting what actually loaded
 * rather than by hardcoded id. Mapbox revises its styles without notice, and a
 * hardcoded `road-primary` is a map that silently stops glowing one morning.
 */

/** Black. The imagery is dimmed towards it, not towards a navy. */
const NIGHT = "#000000";
/** White. The roads were sodium-lamp amber. */
const LAMP = "#ffffff";

/**
 * Pulls the satellite tiles to greyscale.
 *
 * Dimming alone was not enough: a satellite image is grass, roofs and -- the
 * thing the spec names outright -- blue water, and 75% black over it is a dark
 * blue sea rather than a grey one. Saturation on the raster layer itself is the
 * only control that reaches the imagery, since a CSS filter over the canvas
 * would take the pins and labels with it.
 */
function desaturateRaster(map: mapboxgl.Map): void {
  const style = map.getStyle();
  for (const l of (style?.layers ?? []) as AnyLayer[]) {
    if (l.type !== "raster") continue;
    try {
      map.setPaintProperty(l.id, "raster-saturation", -1);
      map.setPaintProperty(l.id, "raster-contrast", 0.15);
    } catch {
      // A layer that will not take it still gets the sheet over it.
    }
  }
}

/** Labels, water and land, all forced to neutral. */
function greyEverythingElse(map: mapboxgl.Map): void {
  const style = map.getStyle();
  for (const l of (style?.layers ?? []) as AnyLayer[]) {
    try {
      if (l.type === "symbol") {
        map.setPaintProperty(l.id, "text-color", "#c2c2c2");
        map.setPaintProperty(l.id, "text-halo-color", "#000000");
      } else if (l.type === "fill" && l.id !== "carz-night") {
        // Water is the one that matters. Mapbox names it variously, so this
        // goes by source-layer and id rather than trusting a single name.
        if (/water|ocean|sea|bay|river/i.test(l.id) || l["source-layer"] === "water") {
          map.setPaintProperty(l.id, "fill-color", "#0a0a0a");
        } else if (/park|green|wood|grass|landuse/i.test(l.id)) {
          map.setPaintProperty(l.id, "fill-color", "#141414");
        }
      }
    } catch {
      // Not every layer accepts every property; the sheet covers the rest.
    }
  }
}

type AnyLayer = mapboxgl.Layer & { id: string; type: string; "source-layer"?: string };

/** Layers that look like roads, by source-layer and id, in draw order. */
function roadLayers(map: mapboxgl.Map): AnyLayer[] {
  const style = map.getStyle();
  if (!style?.layers) return [];
  return (style.layers as AnyLayer[]).filter(
    (l) =>
      l.type === "line" &&
      (l["source-layer"] === "road" || /road|street|motorway|highway|trunk/i.test(l.id)),
  );
}

/**
 * The dimming sheet.
 *
 * A `background` layer would be wrong: in a satellite style it sits beneath the
 * imagery and would never be seen. This is a full-extent fill inserted directly
 * *above* the raster and *below* the first road layer, so the ground goes dark
 * and the roads that are about to glow are not dimmed along with it.
 */
export function addNightSheet(map: mapboxgl.Map): void {
  if (map.getLayer("carz-night")) return;
  const firstRoad = roadLayers(map)[0]?.id;

  map.addSource("carz-night-src", {
    type: "geojson",
    data: {
      type: "Feature",
      geometry: {
        type: "Polygon",
        // The whole world, in one quad. Mercator cannot reach the poles, hence
        // 85 rather than 90.
        coordinates: [
          [
            [-180, -85],
            [180, -85],
            [180, 85],
            [-180, 85],
            [-180, -85],
          ],
        ],
      },
      properties: {},
    },
  });

  map.addLayer(
    {
      id: "carz-night",
      type: "fill",
      source: "carz-night-src",
      paint: { "fill-color": NIGHT, "fill-opacity": 0.55 },
    },
    firstRoad,
  );
}

/**
 * Roads as streetlights.
 *
 * Two layers, not one. A single blurred line reads as out of focus; a wide soft
 * pass under a narrow bright one reads as something emitting light, which is
 * what a lit road at night actually looks like from above.
 */
export function lightRoads(map: mapboxgl.Map): void {
  for (const layer of roadLayers(map)) {
    try {
      map.setPaintProperty(layer.id, "line-color", LAMP);
      map.setPaintProperty(layer.id, "line-blur", 1.8);
      map.setPaintProperty(layer.id, "line-opacity", 0.9);

      const glowId = `${layer.id}-carz-glow`;
      if (map.getLayer(glowId)) continue;
      const width = map.getPaintProperty(layer.id, "line-width");
      map.addLayer(
        {
          id: glowId,
          type: "line",
          source: (layer as unknown as { source: string }).source,
          "source-layer": layer["source-layer"],
          filter: (layer as unknown as { filter?: unknown }).filter as never,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": LAMP,
            "line-blur": 6,
            "line-opacity": 0.35,
            // Three times the road's own width, whatever expression that is.
            "line-width": width
              ? (["*", width, 3] as never)
              : (4 as never),
          },
        },
        layer.id, // beneath the crisp line
      );
    } catch {
      // One layer refusing is not worth failing the map over; the rest still
      // light up.
    }
  }
}

/** Elevation and the sky it sits under. */
export function addTerrainAndSky(map: mapboxgl.Map): void {
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1.3 });
  map.setFog({
    color: NIGHT,
    // Was a navy horizon over a near-black space. Both neutral now.
    "high-color": "#1a1a1a",
    "horizon-blend": 0.08,
    "space-color": "#000000",
    "star-intensity": 0.95,
  });
}

/** Everything, in the order it has to happen. */
export function applyMidnight(map: mapboxgl.Map): void {
  // Saturation first: the sheet and the road glow go on top of imagery that is
  // already grey, so nothing downstream has to fight a blue underneath it.
  desaturateRaster(map);
  addNightSheet(map);
  greyEverythingElse(map);
  lightRoads(map);
  addTerrainAndSky(map);
}

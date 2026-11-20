import type mapboxgl from "mapbox-gl";

/**
 * The map, looking like the world.
 *
 * What was here before turned a daytime satellite style into midnight: the
 * imagery pulled to greyscale with raster-saturation -1, a 55% black sheet
 * over the ground, water and parks forced to near-black, roads redrawn as
 * white sodium lamps. It was handsome and it was a monochrome photograph of a
 * city, which is the opposite of what a map of real cars in real places should
 * look like.
 *
 * So none of that. The imagery is left alone -- grass is green, water is blue,
 * roofs are whatever colour they are -- and realism comes from the three
 * things that actually make a map look like a place:
 *
 *  - Mapbox Standard Satellite, with everything it would normally draw on
 *    top of the photography turned off.
 *  - Real elevation under the imagery, so hills are hills.
 *  - Light that follows the app's theme: day in light mode, night in dark.
 *
 * This is the one screen in the app that is deliberately not monochrome. §7's
 * palette governs the interface; the imagery is a photograph of the world, and
 * desaturating it was the complaint.
 */

/**
 * The light follows the app's theme, not the clock.
 *
 * Mapbox's presets relight the whole basemap -- sun angle, shadow length, lit
 * windows, sky. "night" works by dimming the satellite photograph, which is
 * the right thing to do inside a dark app and the wrong thing inside a light
 * one; a bright aerial behind black type is the same mismatch the home hero
 * had.
 *
 * Read from the class the theme script puts on <html> before first paint, so
 * the first frame of the map is already the right one. The other two presets,
 * "dawn" and "dusk", are unused -- there are two themes, not four.
 */
export function lightPresetForTheme(): "day" | "night" {
  if (typeof document === "undefined") return "day";
  return document.documentElement.classList.contains("dark") ? "night" : "day";
}

/** Elevation under the imagery. */
function addTerrain(map: mapboxgl.Map): void {
  if (!map.getSource("mapbox-dem")) {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
  }
  // 1.2 rather than the 1.3 the night version used. Exaggeration past about
  // 1.2 reads as a relief model rather than as ground once the imagery is in
  // colour and the shadows are real.
  map.setTerrain({ source: "mapbox-dem", exaggeration: 1.2 });
}

/**
 * Everything, in the order it has to happen.
 *
 * Each step is its own try: a style revision that renames a config key should
 * cost the lighting, not the terrain, and never the map.
 */
export function applyRealism(map: mapboxgl.Map): void {
  try {
    // Standard and Standard Satellite expose their basemap as configuration
    // rather than as layers -- there is no raster layer to recolour and no
    // road layer to restyle, which is also why the old runtime repaint could
    // not have worked against this style.
    map.setConfigProperty("basemap", "lightPreset", lightPresetForTheme());
    map.setConfigProperty("basemap", "show3dObjects", true);
    /**
     * Nothing on top of the photograph.
     *
     * Standard Satellite draws a whole vector map over the imagery -- road
     * lines, transit lines, place names, road shields, POI pills, admin
     * borders -- and this screen has its own pins on it. With all of it off,
     * what is left is the aerial itself and the cars people found, which is
     * what the map is for.
     *
     * Every one of these is a documented Standard Satellite config property;
     * showRoadsAndTransit is the one that takes the road *lines* rather than
     * only their labels, which is what made the city look like a diagram.
     * Each is set on its own so a style revision that drops one does not take
     * the rest with it.
     */
    for (const [key, value] of [
      ["showRoadsAndTransit", false],
      ["showPedestrianRoads", false],
      ["showRoadLabels", false],
      ["showPlaceLabels", false],
      ["showPointOfInterestLabels", false],
      ["showTransitLabels", false],
      ["showAdminBoundaries", false],
    ] as const) {
      try {
        map.setConfigProperty("basemap", key, value);
      } catch {
        /* a style without this property; the rest still apply */
      }
    }
  } catch {
    /* the style draws at its default lighting */
  }
  try {
    addTerrain(map);
  } catch {
    /* flat ground is still a map */
  }
}

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
 *  - Mapbox Standard Satellite, which puts 3D buildings and labels over the
 *    photography rather than beside it.
 *  - Real elevation under the imagery, so hills are hills.
 *  - Daylight, always.
 *
 * This is the one screen in the app that is deliberately not monochrome. §7's
 * palette governs the interface; the imagery is a photograph of the world, and
 * desaturating it was the complaint.
 */

/**
 * Always "day", and that is the realistic choice rather than the lazy one.
 *
 * Mapbox's four presets relight the whole basemap -- sun angle, shadow length,
 * lit windows, sky. Following the device clock sounds more real and is not:
 * satellite imagery is photographed in daylight, so the night preset works by
 * dimming that photograph, which is a darker version of the exact complaint
 * this change answers. Day is the light the pictures were taken in, and it is
 * also the one you can find a car in.
 *
 * Swap this for a clock if you want dusk in the evening -- the preset names
 * are "dawn", "day", "dusk" and "night".
 */
const LIGHT_PRESET = "day";

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
    map.setConfigProperty("basemap", "lightPreset", LIGHT_PRESET);
    map.setConfigProperty("basemap", "show3dObjects", true);
  } catch {
    /* the style draws at its default lighting */
  }
  try {
    addTerrain(map);
  } catch {
    /* flat ground is still a map */
  }
}

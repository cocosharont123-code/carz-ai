import type mapboxgl from "mapbox-gl";

/**
 * The map, stylised: plain blocks on flat ground, seen from an angle.
 *
 * What was here before was Standard Satellite -- real aerial photography,
 * terrain under it, in colour. This is the opposite brief: a model of a city
 * rather than a picture of one, in the app's own black and white, which is
 * what Snap Map does and what a screen full of white pins actually needs
 * behind it.
 *
 * Everything below is Standard's documented configuration rather than layers
 * of our own. Standard does not expose its basemap as layers -- there is no
 * road layer to recolour and no building layer to restyle -- so config is not
 * a shortcut here, it is the API. Checked against
 * docs.mapbox.com/map-styles/standard/guides, which is also where the four
 * separate 3D toggles come from: the single `show3dObjects` switch would have
 * taken the buildings down with the trees.
 */

/** Dark or light, read from the class the theme script puts on <html>. */
export function isDarkTheme(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

/**
 * Night in dark mode, day in light.
 *
 * The brief asks for the app's dark palette, and in dark mode that is exactly
 * what this is. A light-mode user gets the same map lit from above instead of
 * a black rectangle in a white app -- the same rule the rest of the app
 * follows, and the one this screen was already following.
 */
export function lightPresetForTheme(): "day" | "night" {
  return isDarkTheme() ? "night" : "day";
}

/**
 * The palette. Monochrome in both themes: §7 and "no blue, no neon".
 *
 * Read in the order the eye sorts them. Water is the darkest thing on a dark
 * map and the darkest thing on a light one too -- it is the hole in the
 * ground either way -- the land sits above it, and the roads sit a step above
 * the land so the network reads without a single label.
 */
type Palette = {
  land: string;
  water: string;
  green: string;
  road: string;
  trunk: string;
  motorway: string;
  buildingHighlight: string;
  /** Short buildings. */
  buildingLow: string;
  /** Towers. The ramp between the two is what gives a skyline a skyline. */
  buildingHigh: string;
};

/**
 * Written brighter than it looks.
 *
 * Every colour here goes through the style's lighting before it reaches the
 * screen, and the night preset is a dim scene by definition -- the first
 * version of this palette was mixed to the values the design wanted and came
 * out as black on black. These are the values that *render* as charcoal at
 * night, which is why they look a stop too light sitting in the file.
 */
const DARK: Palette = {
  // Neutral greys, not blue-greys. The first mix carried a few points more
  // blue than red, which on a screen full of concrete reads as dusk -- and
  // "no blue" is in the brief. R, G and B are within two points of each
  // other on every colour here.
  land: "#232325",
  water: "#0b0b0c",
  green: "#1d1d1f",
  road: "#3e3e41",
  trunk: "#46464a",
  motorway: "#4f4f53",
  buildingHighlight: "#6e6e72",
  buildingLow: "#303032",
  buildingHigh: "#4d4d50",
};

const LIGHT: Palette = {
  land: "#eaeaeb",
  water: "#d4d4d5",
  green: "#e2e2e3",
  road: "#ffffff",
  trunk: "#fbfbfb",
  motorway: "#f7f7f7",
  buildingHighlight: "#bcbcbe",
  // Daylight is a bright scene, so these are read almost as written -- the
  // dark palette's headroom is not needed here.
  buildingLow: "#fcfcfc",
  buildingHigh: "#d6d6d8",
};

/**
 * Every config property, each set on its own.
 *
 * One try per property on purpose: a style revision that renames or drops one
 * key should cost that key and nothing else. They were in a single try block
 * once and a rename would have taken the whole look down with it.
 */
function applyConfig(map: mapboxgl.Map, entries: readonly (readonly [string, unknown])[]): void {
  for (const [key, value] of entries) {
    try {
      map.setConfigProperty("basemap", key, value);
    } catch {
      /* a style without this property; the rest still apply */
    }
  }
}

/**
 * @param buildings false on a device that said it could not hold them, which
 * leaves the same flat map without the extrusions.
 */
export function applySnapLook(map: mapboxgl.Map, buildings: boolean): void {
  const c = isDarkTheme() ? DARK : LIGHT;

  applyConfig(map, [
    ["lightPreset", lightPresetForTheme()],
    // Standard's own greyscale LUT. It is what takes the last of the colour
    // out of the things config does not name -- sand, rock, the tint on
    // glass roofs -- so the overrides below are not fighting a brown desert.
    ["theme", "monochrome"],

    /**
     * Blocks, and only blocks.
     *
     * Standard ships four kinds of 3D object and the brief wants one of them.
     * Trees and landmark models are what make the default style read as a
     * toy city, and facades are the window-and-door texturing on tall
     * buildings -- off, so a building is a flat-shaded extrusion whose lit
     * side is lighter and whose shaded side is not, which is the whole look.
     */
    /**
     * Standard's own buildings stay off; ours go on instead.
     *
     * Standard has no colorBuildings -- the config list has colours for
     * land, water, greenspace and roads and nothing for the blocks, which
     * take theirs from the light preset. Under the night preset that is a
     * near-black building on near-black ground, which is the one thing this
     * look cannot have: the whole read is pale blocks standing on dark
     * ground. So the extrusions below are ours, on the same Mapbox Streets
     * buildings the style itself draws from, where the colour is a paint
     * property we set.
     */
    ["show3dObjects", false],
    ["show3dBuildings", false],
    ["show3dTrees", false],
    ["show3dLandmarks", false],
    ["show3dFacades", false],
    ["showLandmarkIcons", false],
    ["showLandmarkIconLabels", false],

    /**
     * Clutter off, names on.
     *
     * This screen draws its own pins and has its own search; a POI pill for a
     * coffee shop is something else to tap by accident. Place and road labels
     * stay -- a map with no names is a pattern, and knowing which
     * neighbourhood a car was found in is most of the point.
     */
    ["showPointOfInterestLabels", false],
    ["showTransitLabels", false],
    ["showAdminBoundaries", false],
    ["showPedestrianRoads", false],
    ["showHdRoads", false],
    ["showIndoor", false],
    ["showIndoorLabels", false],
    ["showPlaceLabels", true],
    ["showRoadLabels", true],

    ["colorLand", c.land],
    ["colorWater", c.water],
    ["colorGreenspace", c.green],
    // Land use is land. Standard tints commercial, education, medical and
    // industrial districts by default, which on a monochrome map reads as
    // four shades of smudge.
    ["colorCommercial", c.land],
    ["colorEducation", c.land],
    ["colorMedical", c.land],
    ["colorIndustrial", c.land],
    ["colorRoads", c.road],
    ["colorTrunks", c.trunk],
    ["colorMotorways", c.motorway],
    ["colorBuildingHighlight", c.buildingHighlight],
  ]);

  /**
   * No terrain.
   *
   * The satellite version put a real elevation mesh under the imagery, which
   * is what made hills hills. The ground is flat here by request, and
   * dropping the mesh takes a DEM tile source and a per-frame deformation off
   * a phone that is already drawing extrusions.
   */
  try {
    map.setTerrain(null);
  } catch {
    /* no terrain to remove */
  }

  if (buildings) addBlocks(map, c);
  else removeBlocks(map);
}

/** The id is shared by both functions and by the restyle on a theme change. */
const BLOCKS = "carz-blocks";

/**
 * Plain extruded blocks.
 *
 * Mapbox Streets v8 is the same building data Standard extrudes; taking it
 * directly is what buys the paint properties. Everything about the layer is
 * chosen to be a block and not a building:
 *
 *  - one flat colour, ramped by height, so a tower is lighter than a shed
 *    and a skyline reads from across the screen;
 *  - vertical-gradient off, which is what "flat-shaded" means here -- with
 *    it on, every face fades towards its base and the city looks printed;
 *  - the sides still catch the style's own light, so the lit face is a shade
 *    lighter than the shaded one, which is the only shading in the look;
 *  - ambient occlusion at the base, which is what keeps a block from
 *    floating off the ground.
 *
 * In the "middle" slot: above the ground and the roads, below the labels, so
 * a street name is never buried under a tower.
 */
function addBlocks(map: mapboxgl.Map, c: Palette): void {
  try {
    if (!map.getSource("carz-buildings")) {
      map.addSource("carz-buildings", {
        type: "vector",
        url: "mapbox://mapbox.mapbox-streets-v8",
      });
    }
    if (map.getLayer(BLOCKS)) map.removeLayer(BLOCKS);
    map.addLayer({
      id: BLOCKS,
      type: "fill-extrusion",
      source: "carz-buildings",
      "source-layer": "building",
      slot: "middle",
      // Only the parts meant to stand up. The layer carries footprints that
      // are not extrudable at all, and drawing those gives a city of kerbs.
      filter: ["all", ["==", ["get", "extrude"], "true"], [">", ["get", "height"], 0]],
      minzoom: 14,
      paint: {
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "height"],
          0,
          c.buildingLow,
          120,
          c.buildingHigh,
        ],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "min_height"],
        "fill-extrusion-vertical-gradient": false,
        /**
         * Mostly emissive, deliberately.
         *
         * Without this the blocks are lit by the night preset's scene
         * lighting, which is dim by design -- a charcoal building renders
         * black on black ground, which is what the first pass of this
         * looked like. At 0.85 the colour above is very nearly what reaches
         * the screen, and the 15% left over is what the directional light
         * still gets to do: the face turned towards it stays a shade
         * lighter than the face turned away, which is the only shading in
         * the look and the thing that makes a block read as a solid.
         */
        "fill-extrusion-emissive-strength": 0.85,
        "fill-extrusion-ambient-occlusion-intensity": 0.3,
        "fill-extrusion-ambient-occlusion-radius": 3,
        // Faded in over a zoom level rather than appearing all at once: at
        // 14 the blocks are a texture, and popping a texture into existence
        // mid-pinch is the kind of thing that reads as a bug.
        "fill-extrusion-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
      },
    });
  } catch {
    /* no blocks; the flat map is still the map */
  }
}

function removeBlocks(map: mapboxgl.Map): void {
  try {
    if (map.getLayer(BLOCKS)) map.removeLayer(BLOCKS);
  } catch {
    /* nothing to remove */
  }
}

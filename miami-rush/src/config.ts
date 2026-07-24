/**
 * Miami Rush — central tuning.
 *
 * Every gameplay / art constant lives here so the game can be balanced from one
 * file. TUNING.md documents these in prose; keep the two in sync when editing.
 */

// ---------------------------------------------------------------------------
// Palette (golden-hour Miami)
// ---------------------------------------------------------------------------
export const PALETTE = {
  indigo: 0x221a3a, // deep sky / shadow base
  duskRose: 0xc95d8a, // horizon band
  sunsetAmber: 0xff9b4a, // the sun + warm rim light
  miamiBlue: 0x19b6d8, // player car + accents
  coral: 0xff5a5f, // taillights, danger, beacons
  cream: 0xf7efe0, // "MIAMI" title, UI text
  asphalt: 0x2a2740,
  concrete: 0x6b6580,
  sand: 0xe9c9a0,
} as const;

// CSS-facing hex strings (UI layer).
export const CSS = {
  indigo: "#221a3a",
  duskRose: "#c95d8a",
  sunsetAmber: "#ff9b4a",
  miamiBlue: "#19b6d8",
  coral: "#ff5a5f",
  cream: "#f7efe0",
} as const;

// ---------------------------------------------------------------------------
// Highway geometry
// ---------------------------------------------------------------------------
export const ROAD = {
  laneCount: 4,
  laneCenters: [-5.25, -1.75, 1.75, 5.25],
  steerMin: -6,
  steerMax: 6,
  width: 15, // drivable asphalt width
  segmentLength: 40, // length of one recycled road segment
  drawDistance: 520, // how far ahead the world extends (z-)
  playerZ: 2, // the player sits at a fixed z; the world scrolls toward it
} as const;

// ---------------------------------------------------------------------------
// Player / speed
// ---------------------------------------------------------------------------
export const PLAYER = {
  baseSpeedStart: 30, // m/s at launch
  baseSpeedMax: 120, // m/s top (~430 km/h)
  speedRampTime: 55, // seconds to ramp from start -> max
  steerLerp: 0.18, // how snappily the car eases toward the target x
  maxRoll: 0.5, // rad of body roll at full steer
  maxYaw: 0.32, // rad of yaw into the turn
  // AABB half-extents used for collision (metres).
  halfWidth: 0.95,
  halfLength: 2.1,
} as const;

// ---------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------
export const TRAFFIC = {
  poolMin: 8,
  poolMax: 16,
  speedFracMin: 0.22, // fraction of player base speed
  speedFracMax: 0.4,
  spawnAheadZ: -480, // where new traffic appears (world z)
  despawnBehindZ: 30, // recycled once well behind the player
  minGapSameLane: 22, // metres kept from the car ahead in a lane
  spawnGapMin: 26, // min z-gap between spawns in a lane
  laneChangeChance: 0.28, // per eligible check
  laneChangeCooldown: 2.4, // s between a car's lane changes
  laneChangeClearance: 30, // required clear metres in the target lane
  laneChangeSpeed: 3.2, // lateral m/s while changing lanes
} as const;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
export const SCORING = {
  nearMissLateral: 2.6, // metres — how close a pass must be
  nearMissBase: 50,
  comboWindow: 2.6, // seconds to chain
  comboCap: 5,
} as const;

// ---------------------------------------------------------------------------
// Crash / feel
// ---------------------------------------------------------------------------
export const CRASH = {
  slowMoScale: 0.22, // timescale at impact
  slowMoRecover: 0.9, // per second easing back toward 1
  shakeDuration: 0.6,
  shakeMagnitude: 0.9,
  debrisCount: 42,
} as const;

// ---------------------------------------------------------------------------
// Camera / speed feel
// ---------------------------------------------------------------------------
export const CAMERA = {
  fovBase: 78,
  fovMax: 92,
  position: [0, 3.05, 9.5] as [number, number, number],
  lookAt: [0, 1.2, -18] as [number, number, number],
  speedShake: 0.06, // scaled by speed fraction
  streakStartKmh: 220, // additive speed streaks kick in
} as const;

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------
export const MS_TO_KMH = 3.6;

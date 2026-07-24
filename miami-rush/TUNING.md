# TUNING.md

Every gameplay / feel constant lives in [`src/config.ts`](./src/config.ts). This
document explains what each one does so the game can be balanced without reading
code. Edit `config.ts`; keep this file in sync.

## Palette (`PALETTE` / `CSS`)

Golden-hour Miami. Used by both Three.js materials (`PALETTE`, hex numbers) and
the DOM HUD (`CSS`, hex strings).

| Name | Hex | Role |
| --- | --- | --- |
| indigo | `#221a3a` | deep sky / shadow base |
| duskRose | `#c95d8a` | horizon band, lifeguard huts |
| sunsetAmber | `#ff9b4a` | the sun, warm rim light, HUD eyebrows |
| miamiBlue | `#19b6d8` | player car, accents, exhaust, combo text |
| coral | `#ff5a5f` | taillights, danger flash, rooftop beacons |
| cream | `#f7efe0` | "MIAMI" title, UI text |

## Highway (`ROAD`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `laneCount` | 4 | lanes |
| `laneCenters` | `-5.25, -1.75, 1.75, 5.25` | lane centre x |
| `steerMin` / `steerMax` | `-6` / `6` | steerable x range |
| `width` | 15 | drivable asphalt width |
| `drawDistance` | 520 | how far ahead (−z) the world extends |
| `playerZ` | 2 | fixed z the player sits at; the world scrolls toward it |

## Player & speed (`PLAYER`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `baseSpeedStart` | 30 m/s | launch speed |
| `baseSpeedMax` | 120 m/s | top speed (~430 km/h) |
| `speedRampTime` | 55 s | time to ramp start → max |
| `steerLerp` | 0.18 | how snappily the car eases to the finger (higher = snappier) |
| `maxRoll` | 0.5 rad | body roll at full steer |
| `maxYaw` | 0.32 rad | yaw into the turn |
| `halfWidth` / `halfLength` | 0.95 / 2.1 | player AABB half-extents for collision |

Nitro is **permanent** — there is no button or meter; the speed simply ramps and
the HUD shows a pulsing "Nitro Open" tag with always-on blue exhaust flames.

## Traffic (`TRAFFIC`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `poolMin` / `poolMax` | 8 / 16 | pooled car count (max also clamped by graphics quality) |
| `speedFracMin` / `speedFracMax` | 0.22 / 0.40 | traffic speed as a fraction of the player's base speed |
| `spawnAheadZ` | −480 | where new traffic appears |
| `despawnBehindZ` | 30 | recycled once this far behind |
| `minGapSameLane` | 22 m | distance kept from the car ahead in a lane |
| `laneChangeChance` | 0.28 | per eligible check |
| `laneChangeCooldown` | 2.4 s | between a car's lane changes |
| `laneChangeClearance` | 30 m | required clear space in the target lane |

Spawning never fills all four lanes in one z-band — if only one lane has room at
the spawn line it is left open as an escape route.

## Scoring (`SCORING`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `nearMissLateral` | 2.6 m | how close a pass counts as a near miss |
| `nearMissBase` | 50 | base near-miss points |
| `comboWindow` | 2.6 s | chain window |
| `comboCap` | 5 | max combo multiplier |

`score = floor(distance in metres) + nearMissPoints`. Each near miss awards
`50 × combo`; the combo climbs to ×5 while chained inside the window.

## Crash (`CRASH`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `slowMoScale` | 0.22 | timescale at impact |
| `slowMoRecover` | 0.9 /s | how fast time eases back to 1 |
| `shakeDuration` / `shakeMagnitude` | 0.6 s / 0.9 | screen shake on impact |
| `debrisCount` | 42 | debris pieces in the burst |

Session best is kept **in memory only** (no localStorage).

## Camera & speed feel (`CAMERA`)

| Constant | Value | Meaning |
| --- | --- | --- |
| `fovBase` → `fovMax` | 78 → 92 | FOV widens with speed |
| `position` | `0, 3.05, 9.5` | chase-cam offset |
| `speedShake` | 0.06 | subtle shake scaled by speed |
| `streakStartKmh` | 220 | additive radial speed streaks kick in |

`prefers-reduced-motion` disables camera shake and body roll and softens streaks.

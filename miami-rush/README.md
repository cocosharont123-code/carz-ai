# Miami Rush

A mobile-first 3D endless racing web game. Golden-hour Miami, a highway aimed
straight at a huge low sun, and nitro welded permanently open. Built with
**Vite + TypeScript + Three.js**, fully static, no backend.

![state: menu → playing → crash → over](./TUNING.md)

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
```

Build a static bundle:

```bash
npm run build    # type-checks then emits dist/
npm run preview  # serve the built dist/
```

`dist/` is fully static (relative asset paths) — drop it on any static host.

## How to play

- **Drag anywhere** to steer — the car eases toward your finger with body roll.
- **Desktop:** Arrow keys or **A / D**.
- Nitro is permanent: you just keep accelerating from ~30 m/s to ~120 m/s
  (~430 km/h). Squeeze past traffic — passing within 2.6 m banks a **near-miss
  combo** (up to ×5). Score = distance + near-miss points.
- Crash and it's slow-mo, debris, and a game-over card. Session best is tracked
  for the session only.

Pause and mute are top-right (the game also auto-pauses when the tab is hidden).
Pick **High / Medium / Low** graphics on the start screen.

## Project structure

```
src/
  config.ts          all gameplay/art constants (mirrored by TUNING.md)
  main.ts            entry: gesture guards + boot
  style.css          HUD + veils (heavy italic condensed art direction)
  scene/
    lighting.ts      sun, hemisphere, PMREM sunset environment, fog
    world.ts         road, barriers, gantries, palms, buildings, sand, ocean, sun
    cars.ts          procedural car factory + glTF override loader
    effects.ts       EffectComposer (bloom, vignette, speed streaks, SMAA) + debris
  game/
    state.ts         menu / playing / paused / crashing / over machine
    input.ts         pointer drag + keyboard steering
    scoring.ts       distance + near-miss combo
    traffic.ts       pooled traffic AI (distance-keeping, lane changes)
    game.ts          orchestrator: loop, collision, camera, crash, quality
  audio/
    engine.ts        synthesized WebAudio engine / whoosh / impact
  ui/
    hud.ts           score/distance/speed/nitro chips, veils, floaters
    settings.ts      High/Medium/Low quality profiles + reduced-motion
```

## Graphics

- ACES filmic tone mapping, sRGB output.
- PMREM sunset environment map so paint, glass and the ocean pick up real
  reflections; the ocean's low roughness turns the sun into a light streak.
- PCF soft shadows with a tight frustum around the road for long golden-hour
  shadows at high resolution.
- Post: bloom on the sun/lights, vignette, radial speed streaks past ~220 km/h,
  SMAA. All of it (plus shadows and pixel-ratio) scales with the quality toggle.
- Performance: pooled/recycled traffic, debris and roadside props; instanced
  barrier delineator posts; device-pixel-ratio capped at 2.

## Cars & assets

The game ships with **detailed procedural cars** (physical clearcoat body, tinted
glass, rims, emissive lights, and always-on blue exhaust on the hero) so it runs
with **zero external downloads**.

To swap in **real glTF models**, drop `.glb` files into `public/models/` and copy
`public/models/manifest.json.example` to `manifest.json`:

```json
{
  "player": { "url": "coupe.glb", "scale": 1.0 },
  "sedan":  { "url": "sedan.glb", "scale": 1.0 }
}
```

Missing entries fall back to procedural automatically. The hero car receives a
Miami-blue clearcoat override regardless of its source paint.

### Suggested CC0 / CC-BY sources (credit here when you add them)

- **Kenney — Car Kit** — CC0 — <https://kenney.nl/assets/car-kit> (coupe, sedan,
  SUV, taxi, van; low-poly and mobile-friendly).
- **Quaternius — Ultimate Vehicles** — CC0 — <https://quaternius.com/>.
- **Poly Pizza** — mixed CC0/CC-BY — <https://poly.pizza/> (check each model's
  licence and credit the author).

> Asset credits: _procedural cars by this project; no third-party models bundled.
> Add attribution lines above once you drop real `.glb` files in._

## Accessibility & mobile

- `prefers-reduced-motion` disables camera shake and body roll and softens the
  speed streaks.
- Safe-area insets, `touch-action: none`, no pinch/double-tap zoom, DPR capped.

Tuning lives in one place — see [TUNING.md](./TUNING.md).

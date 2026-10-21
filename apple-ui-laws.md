# APPLE UI LAW BOOK — carz.dev

Closest-to-Apple web UI. Zero lag. Liquid Glass on every surface that can hold it. Squircles, never plain rounded rects. No extra scroll. No dumb headers.

These laws override framework defaults, library styles and "best practice" habits. When laws collide, this is the precedence:

1. Zero lag — never negotiable
2. No extra scroll, no outer scroll, no zoom
3. Liquid Glass on every eligible surface
4. Squircle corners
5. Apple fidelity in everything else (type, color, motion, layout)

Run the Definition of Done (§10) before calling any UI task finished. "Should be fine" is not a status; measure.

## 0. Prime laws

1. 120 fps or it doesn't ship. Animate only `transform` and `opacity`. Never animate layout, shadows, blur, radius or filters.
2. Glass is the floating layer: nav, tab bar, toolbars, buttons, search, menus, sheets, toasts, overlays on media. Content underneath stays opaque/vibrant. Never glass-on-glass.
3. Max 6 live `backdrop-filter` elements visible per screen. Repeated or scrolling items use `.glass-lite` (no blur). Adjacent controls share one glass surface (a cluster).
4. Every corner is `corner-shape: squircle`. Capsules and circles are `corner-shape: round`. Nested corners are concentric: inner radius = outer radius − gap.
5. One scroll container per screen: `<main>`. `html`/`body` never scroll. Never `100vh`. Never `min-h-screen` inside the shell. A screen whose content fits does not scroll. Period.
6. One title per screen. Any other heading exists only if deleting it would confuse someone. Never label the obvious.
7. System font, HIG type scale, 8px grid, 44px touch targets, safe areas on every edge-hugging element.
8. Short springy motion (150–500 ms). Respect `prefers-reduced-motion` and `prefers-reduced-transparency`.
9. If a nice-to-have costs a frame, cut it. There is no "optimize later".

## 1. Performance — zero lag

Frame 8.3 ms target, 16 ms hard max. No long task > 50 ms. INP <= 100 ms. CLS = 0. LCP <= 1.8 s. Lighthouse mobile Performance >= 95. Client JS per route <= 150 kB gzipped.

Animate only `transform` and `opacity`. Forbidden: `width/height/top/left/inset`, `margin/padding/gap`, `box-shadow`, `border-radius`, `filter`, `backdrop-filter`, `background-size/position`. Color may transition <= 200 ms on small controls only.

A shadow that "changes" = two layers crossfaded with opacity. `will-change: transform` only via a class added right before an animation and removed right after. No `filter: blur()` on large areas, no `mix-blend-mode` on anything that scrolls, no `background-attachment: fixed`, no shadows with > 40 px blur on repeated elements.

Long lists: `content-visibility: auto; contain-intrinsic-size: auto 120px;`. Images: `next/image` with real dimensions, accurate `sizes`, `priority` on the LCP image only, thumbnails <= 2x rendered size. Fonts: system stack only, zero downloads.

Server Components by default. `"use client"` only where there is state or handlers. Zero scroll listeners that set React state. Press feedback is CSS `:active`. Suspense boundaries reserve exact size.

## 2. Liquid Glass

Glass is the material of the layer that floats above content. It needs something behind it: glass over flat black with nothing scrolling beneath is a gray box. If nothing passes under a surface, it is a standard surface (`--bg-2`), not `.glass`.

Glass goes on: nav bar, tab bar, toolbars, FABs, back/close over media, search, chip clusters, segmented controls, secondary buttons, menus, popovers, sheets, alerts, toasts, badges over photos, map controls, media overlays, sticky CTA bars, switch/slider knobs while dragged, tooltips.

Glass never goes on: list rows, text cards on a plain background, the page background, anything inside another glass element, repeated items in a scrolling grid (-> `.glass-lite`), surfaces with nothing beneath them.

Variants: `.glass` (default), `.glass--clear` (over photos/video/maps, on a dim layer), `.glass--tint` (primary action only, one per view), `.glass-lite` (no blur; repeated items, low-end devices, reduced transparency). Cluster: adjacent controls share ONE glass container.

Anatomy, all required: translucent fill, `blur(18px) saturate(170%)` (never above 24 px), 1 px inset rim + 0.5 px hairline, soft ambient shadow, squircle or capsule, dark mode via `light-dark()`.

Performance: <= 6 visible `backdrop-filter` elements per screen. Never on repeated items. Never animate blur/size/fill-opacity; move with `transform` only. `isolation: isolate` on every glass element. Never nest glass. `prefers-reduced-transparency: reduce` -> `.glass-lite`. Honor `<html data-glass="lite">` set at boot when `hardwareConcurrency < 4` or `deviceMemory < 4`. Refraction (`feDisplacementMap`) default OFF.

## 3. Squircles

Every corner is continuous. `corner-shape: squircle` renders in Chromium 139+; Safari and Firefox show round corners until they ship it.

1. Global: `*, ::before, ::after { corner-shape: squircle; }` and `.rounded-full, .capsule { border-radius: 9999px; corner-shape: round; }`
2. Fixed-aspect media that must be squircle on Safari: build-time SVG masks (`figma-squircle`, `cornerSmoothing: 0.6`), one per ratio.
3. Variable-size hero containers (<= 6 per screen, no shadow needed): `@squircle-js/react`.
4. Everything else renders round on Safari until it ships `corner-shape`.

Radius tokens: `--r-xs: 8px`, `--r-sm: 12px`, `--r-md: 18px`, `--r-lg: 26px`, `--r-xl: 38px`.

Concentric law: child radius = parent radius − gap. Floating edge elements inset 12–16 px. Exception: edge-to-edge photo grids (Garage) stay square, 1 px gaps, radius 0.

## 4. Layout and scroll

`html, body { height: 100%; overflow: hidden; overscroll-behavior: none; }` — the document never scrolls. `#app { height: var(--vvh, 100dvh); overflow: hidden; }`. `main { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior-y: contain; }` with bottom padding = tab bar + 12 px + safe area.

One scroller: `main`. Nested `overflow: auto` only for horizontal carousels. Never `100vh`, `h-screen`, `min-h-screen`, or `vh` inside the shell. A screen whose content fits must not scroll: `main.scrollHeight === main.clientHeight`. Never horizontal overflow. Content scrolls under the glass bars; bars never push content down. No scroll-jacking, no smooth-scroll libraries, no custom scrollbars. Inputs >= 16 px so iOS never auto-zooms.

Spacing: 8 px grid. Side margins 16 px (< 400 px) / 20 px (>= 400 px). 20 px between sections, 10 px between cards, rows >= 44 px.

Keyboard-aware shell via `visualViewport` setting `--vvh`.

## 5. Headers and text

One title per screen: Large Title 34/41 bold, collapsing to inline 17/600 on scroll. A heading exists only if deleting it would confuse someone. Section headers need >= 2 sibling groups AND non-obvious grouping. Max one heading between the screen title and the first content.

Forbidden: labels naming what is visibly below ("Photos" over a photo grid, "Search" above a search field), tiny uppercase eyebrows over a single item, a header above a card that has its own title, duplicate titles, greeting headers, headers on empty states, floating mini-labels above every input, headings used as spacing.

Type scale (size/line, weight, tracking): Large Title 34/41 700 +0.37 · Title1 28/34 700 +0.36 · Title2 22/28 700 +0.35 · Title3 20/25 600 +0.38 · Headline 17/22 600 −0.41 · Body 17/22 400 −0.41 · Callout 16/21 400 −0.32 · Subheadline 15/20 400 −0.24 · Footnote 13/18 400 −0.08 · Caption1 12/16 400 0 · Caption2 11/13 400 +0.07.

Font: `-apple-system, BlinkMacSystemFont, system-ui, "Helvetica Neue", sans-serif`. Never self-host SF Pro. Weights 400/600/700 only (500 for tab labels). Max 4 text sizes per screen. Tabular numerals for prices, bids, timers, counts. Sentence case; no ALL-CAPS buttons; buttons are verbs.

## 6. Interaction and motion

Press: `:active { transform: scale(.97) }` on glass buttons and cards; text buttons dim to `.6`. Durations: micro 150–200 ms, standard 300–350 ms, presentations 450–500 ms, never above 600 ms. Easing `cubic-bezier(.32,.72,0,1)`.

Page transitions: push slides in from the right, outgoing to −30% and dims, 350 ms; sheet slides up 500 ms; tab switch 200 ms crossfade. Touch targets >= 44 px. Hover only inside `@media (hover: hover)`. Reduced motion: crossfades <= 150 ms, no scale, no slide.

Focus: `:focus-visible` only, 3 px key-color ring at 50%, `outline-offset: 2px`. Loading: content streams into fixed-size slots; spinner inside the control that triggered it; never a centered full-screen spinner. Never `window.alert/confirm`. Toasts: one at a time, top, capsule glass, 3 s.

## 7. Color, dark mode, materials

`color-scheme: light dark`, every token via `light-dark()`. Semantic tokens only. Dark-first: background `#000`, surfaces `#1C1C1E`/`#2C2C2E`, labels white 100/60/30%, key color white (`--on-key: #000`). No blue, neon, hot pink or yellow.

Separators 0.5 px inset 16 px from the leading edge, none after the last row. No borders around cards — contrast separates them. Shadows: glass has its ambient shadow; content cards none; popovers/sheets `0 10px 40px rgb(0 0 0 / .35)`.

Icons: one set, SF-like weight (Lucide 1.75 px stroke), sizes 17/20/22/28, `currentColor`, monochrome. Never emoji as icons, never two sets. SF Symbols cannot ship on the web.

Media: car photos masked 4:3 or 16:9 squircle, `object-fit: cover`. Bottom gradient only when glass or text sits on the photo.

## 8. Component specs

Nav bar sticky in `main`, large title collapsing to inline. Tab bar floating capsule glass, <= 5 tabs, selected pill slides. Search capsule glass 44 px. Buttons capsule: large 50, regular 44, small 34; primary white capsule with black 17/600. Lists: inset grouped cards on `--bg`, rows 44–60 px, inset hairlines, no shadows — rows are standard surfaces, not glass. Sheets: grabber 36x5, `--r-xl` top corners, 40% scrim, drag to dismiss. Inputs 44 px, `--fill` background, no border, >= 16 px font. Toggles 51x31. Empty state: symbol + one line + one button, centered, no scroll, no header.

Banned Tailwind utilities: `transition-all`, `h-screen`, `min-h-screen`, `backdrop-blur-*` inside any list/grid item, `shadow-*` on content cards, `border` on cards, `uppercase` on buttons.

## 9. Hard NOs

`100vh` / `h-screen` / `min-h-screen` / `vh` in the shell · a second same-axis scroller · `overflow-x: hidden` on body as a fix · spacer divs · "just in case" padding · `border-radius` without the global squircle rule · `rounded-full` without `corner-shape: round` · nested elements sharing one radius · animating layout/shadow/radius/filter · `transition-all` · permanent `will-change` · `backdrop-filter` on repeated items · more than 6 glass surfaces · glass inside glass · glass over nothing · scroll listeners that set state · smooth-scroll or parallax libraries · custom scrollbars · headers that name the obvious · duplicate titles · greeting headers · headers on empty states · self-hosted SF Pro or SF Symbols · emoji icons · mixed icon sets · Material patterns · centered full-screen spinners · layout shift on load · `window.alert/confirm` · stacked toasts · blue/neon/hot pink/yellow · raw hex inside components · library defaults showing through.

## 10. Definition of Done

1. Build clean, no console errors or warnings on changed screens.
2. Grep gates return nothing:
   `grep -rnE "100vh|min-h-screen|h-screen|transition-all|-webkit-overflow-scrolling|scroll-behavior:\s*smooth" src`
3. Runtime checks at 390x844 on every changed screen: outer scroll false; `main.scrollHeight - main.clientHeight` 0 on fit-screens; nothing wider than the viewport; glass count <= 6.
4. Lighthouse mobile per changed route >= 0.95, CLS 0.
5. Performance recording: no frame over 16 ms, no long task over 50 ms.
6. Safari and Chrome, dark and light, reduced motion and reduced transparency, keyboard open.
7. Header audit: delete each heading mentally; if nothing becomes confusing, delete it for real.
8. Corner audit: global squircle present, capsules round, nested radii concentric, Garage grid square.
9. Glass audit: fill + blur + rim + shadow + shape on each; <= 6 visible; none nested; none repeated; clusters for adjacent controls.
10. Report: screens changed, glass count per screen, scroll-check results, Lighthouse score, anything cut for performance.

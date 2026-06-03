# 🚗 Car Spotter

Snap a photo of any car and instantly get the make, model, year, specs, valuation —
plus a live map of where cars gather near you. Built on **Next.js 16 + React 19 +
Tailwind 4 + shadcn**, with car identification powered by the **Claude vision API**.

## Quick start

```bash
# 1. Install deps (Node 18+; this repo was set up with Node 22)
npm install

# 2. Add your Anthropic API key
cp .env.local.example .env.local
#   then edit .env.local and paste your sk-ant-... key

# 3. Run it
npm run dev
# open http://localhost:3000
```

Without `ANTHROPIC_API_KEY`, the UI still loads and the /spot page shows a clear
"key not configured" notice — only the actual identification call fails.

## How identification works

`src/lib/identify.ts` sends the photo to Claude with a **forced tool schema**
(`report_car`), so the model must return clean structured JSON (make, model, year,
engine, 0–60, used price, fun facts, confidence, and — for Max — valuation,
reliability & collectibility). The key lives server-side only; it is never exposed
to the browser. The route is `src/app/api/identify/route.ts`.

## The plans (the business model)

Defined in one place: **`src/lib/plans.ts`**. Edit the numbers to change the business.

| Plan | Price | Daily limit | Extras |
|------|-------|-------------|--------|
| **Free** | $0 | 2 / day | Core ID + specs + fun facts |
| **Pro** | $9.99/mo | 50 / day | + saved spotting history |
| **Max** | $24.99/mo | Unlimited | + deep valuation/reliability/collectibility reports + **car hotspots map** |

**$35k/mo target** ≈ ~2,000 Pro ($20k) + ~600 Max ($15k). The free tier's 2/day cap
is the funnel lever that drives upgrades.

Usage limits, history and plan are tracked per device in `src/lib/store.ts`
(a simple JSON file at `.data/store.json`, keyed by an `httpOnly` cookie). **Swap this
for a real database** (Postgres/Prisma, Supabase, etc.) before going to production.

## Wiring real payments

`src/app/api/upgrade/route.ts` currently flips the plan **instantly without charging**
(demo mode). For real billing:

1. Create Stripe Products/Prices for Pro and Max.
2. Change `/api/upgrade` to create a **Stripe Checkout session** and redirect to it.
3. Add a `/api/stripe/webhook` route that listens for `checkout.session.completed`
   and only then calls `setPlan(userId, plan)`.
4. Tie the device cookie to a real user account (add auth — e.g. NextAuth/Clerk).

## Integrated UI components (shadcn structure)

The shadcn convention is `src/components/ui/`, configured in `components.json`
(`"ui": "@/components/ui"`). Keeping shared primitives there means the shadcn CLI and
every import path (`@/components/ui/...`) resolve consistently. The four requested
components live there:

- `ui/sparkles.tsx` — tsParticles hero background (landing page)
- `ui/container-scroll-animation.tsx` — Framer Motion scroll showcase (landing page)
- `ui/chatgpt-prompt-input.tsx` — the photo-attach + note input (/spot)
- `ui/mapcn-layer-markers.tsx` — MapLibre map primitives, used by
  `components/car-hotspots-map.tsx` to plot live Overpass car hotspots (Max only)

> Note: tsParticles is pinned to **v3** (`@tsparticles/react@3`, `engine@^3`, `slim@^3`)
> because the component uses the v3 `initParticlesEngine` API.

## Project map

```
src/
  app/
    page.tsx              Landing (sparkles + scroll animation)
    spot/page.tsx         Core spotter (prompt input, results, history, map)
    pricing/page.tsx      Plan cards + upgrade
    api/identify/route.ts Claude vision call + limit enforcement
    api/me/route.ts       Current plan + usage + history
    api/upgrade/route.ts  Change plan (demo billing)
  components/
    site-header.tsx       Nav + live plan badge
    car-hotspots-map.tsx  Max-only Overpass hotspots map
    ui/                   The shadcn + integrated components
  lib/
    plans.ts              the business model
    store.ts              Per-device usage/plan/history
    identify.ts           Claude vision + structured schema
```

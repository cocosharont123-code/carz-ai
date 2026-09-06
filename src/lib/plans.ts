// Everything is free. One plan, all features unlocked, no limits.

export type PlanId = "free";

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  dailyLimit: number | null; // null = unlimited
  premiumReport: boolean;
  saveHistory: boolean;
  hotspotsMap: boolean;
  blurb: string;
  features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    dailyLimit: 3, // Carz+ members get unlimited (enforced in /api/identify)
    premiumReport: true,
    saveHistory: true,
    hotspotsMap: true,
    blurb: "3 scans a day, free.",
    features: [
      "3 car scans per day",
      "Make, model, year & specs",
      "Deep valuation & reliability reports",
      "Spotting map — where to find rare cars",
    ],
  },
};

/**
 * What Carz+ costs and what it unlocks.
 *
 * One definition. The price used to be written out as a literal in eight
 * different files, which is exactly how a price ends up saying two different
 * things on two different screens.
 */
export const CARZ_PLUS = {
  monthly: 7.99,
  annual: 79.99,
  /** Everything here is members-only. Nothing on this list is free. */
  perks: [
    { title: "Auctions 24h early", desc: "See and bid on every listing a full day before anyone else." },
    { title: "Unlimited AI scans", desc: "No cap on car identifications, ever." },
    { title: "Spot cars in video", desc: "Scan a video and identify every car in it." },
    { title: "AI auto-bid", desc: "Set a maximum and the AI bids for you — it knows market value." },
    { title: "Car config", desc: "Restyle any car you spot — colour, rims, mods." },
    { title: "Garage", desc: "A photo album of every car you save." },
    { title: "Wishlist", desc: "Track the cars you're chasing and get told when they appear." },
    { title: "Market-value insight", desc: "See how far over or under market value a car is selling." },
  ],
} as const;

/** "$7.99" — two decimals, because a price with one looks like a typo. */
export const carzPlusMonthly = (): string => `$${CARZ_PLUS.monthly.toFixed(2)}`;
export const carzPlusAnnual = (): string => `$${CARZ_PLUS.annual.toFixed(2)}`;

/** What the annual plan actually saves, computed rather than asserted — the
 *  old copy claimed 33% against a monthly price that has since changed. */
export const carzPlusAnnualSaving = (): number =>
  Math.round((1 - CARZ_PLUS.annual / (CARZ_PLUS.monthly * 12)) * 100);

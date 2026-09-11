// Everything is free. One plan, all features unlocked, no limits.

export type PlanId = "free";

export type Plan = {
  id: PlanId;
  name: string;
  price: number;
  dailyLimit: number | null; // null = unlimited
  premiumReport: boolean;
  saveHistory: boolean;
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
 * The two paid tiers.
 *
 * One definition each. The price used to be written out as a literal in eight
 * files, which is how a price ends up saying two different things on two
 * different screens — and a second tier doubles every chance of that.
 */

/** Scans a day, by tier. null = no cap. */
export const DAILY_SCANS = {
  free: 3,
  plus: 8,
  max: null as number | null,
} as const;

export const CARZ_PLUS = {
  id: "plus" as const,
  name: "Carz+",
  monthly: 7.99,
  annual: 79.99,
  blurb: "For spotting regularly.",
  perks: [
    { title: "8 car scans a day", desc: "Well past the three everyone gets." },
    { title: "Car configurator", desc: "Restyle any car you spot — colour, rims, mods." },
    { title: "Garage", desc: "A photo album of every car you save." },
    { title: "CarzBot", desc: "Ask anything about cars, by voice or text." },
  ],
} as const;

export const CARZ_MAX = {
  id: "max" as const,
  name: "Carz MAX",
  monthly: 12.99,
  annual: 129.99,
  blurb: "Everything in Carz+, without the ceiling.",
  /** Shown under "Everything in Carz+, plus:" — these are the additions. */
  perks: [
    { title: "Unlimited car scans", desc: "No daily cap, ever." },
    { title: "Market-value insight", desc: "See how far over or under market value a car is selling." },
    { title: "Spot cars in video", desc: "Scan a video and identify every car in it." },
    { title: "Events and drops", desc: "Car meets near you, and every new supercar launch." },
  ],
} as const;

export const TIERS = [CARZ_PLUS, CARZ_MAX] as const;

const money = (n: number) => `$${n.toFixed(2)}`;

export const carzPlusMonthly = (): string => money(CARZ_PLUS.monthly);
export const carzPlusAnnual = (): string => money(CARZ_PLUS.annual);
export const carzMaxMonthly = (): string => money(CARZ_MAX.monthly);
export const carzMaxAnnual = (): string => money(CARZ_MAX.annual);

/** Computed rather than asserted, so it cannot go stale against a price. */
export const annualSaving = (m: number, a: number): number =>
  Math.round((1 - a / (m * 12)) * 100);
export const carzPlusAnnualSaving = (): number => annualSaving(CARZ_PLUS.monthly, CARZ_PLUS.annual);
export const carzMaxAnnualSaving = (): number => annualSaving(CARZ_MAX.monthly, CARZ_MAX.annual);

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
  aiAssistant: boolean;
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
    aiAssistant: true,
    blurb: "3 scans a day, free.",
    features: [
      "3 car scans per day",
      "Make, model, year & specs",
      "Deep valuation & reliability reports",
      "Car hotspots map",
      "AI car assistant chat",
    ],
  },
};

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
    dailyLimit: null,
    premiumReport: true,
    saveHistory: true,
    hotspotsMap: true,
    aiAssistant: true,
    blurb: "Everything, free.",
    features: [
      "Unlimited identifications",
      "Make, model, year & specs",
      "Deep valuation, reliability & collectibility reports",
      "Car hotspots map near you",
      "AI car assistant chat",
    ],
  },
};

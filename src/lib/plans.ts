// The freemium model. Edit these numbers to change the business.
// $35k/mo target ≈ ~2,000 Pro ($20k) + ~600 Max ($15k).

export type PlanId = "free" | "pro" | "max";

export type Plan = {
  id: PlanId;
  name: string;
  price: number; // USD / month
  dailyLimit: number | null; // null = unlimited
  premiumReport: boolean; // valuation / reliability / collectibility
  saveHistory: boolean;
  hotspotsMap: boolean; // Max-only nearby car hotspots map
  blurb: string;
  features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    dailyLimit: 2,
    premiumReport: false,
    saveHistory: false,
    hotspotsMap: false,
    blurb: "Spot a couple cars a day.",
    features: [
      "2 identifications / day",
      "Make, model, year & specs",
      "Fun facts",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 9.99,
    dailyLimit: 50,
    premiumReport: false,
    saveHistory: true,
    hotspotsMap: false,
    blurb: "For the daily spotter.",
    features: [
      "50 identifications / day",
      "Everything in Free",
      "Saved spotting history",
      "Priority identification",
    ],
  },
  max: {
    id: "max",
    name: "Max",
    price: 24.99,
    dailyLimit: null,
    premiumReport: true,
    saveHistory: true,
    hotspotsMap: true,
    blurb: "Unlimited, with deep reports & the hotspots map.",
    features: [
      "Unlimited identifications",
      "Everything in Pro",
      "Deep valuation, reliability & collectibility reports",
      "Car hotspots map near you",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "max"];

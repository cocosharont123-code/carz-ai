import type { CarReport } from "./identify";

// ---------------- Badges ----------------
export type Badge = {
  id: string;
  threshold: number;
  name: string;
  emoji: string;
  blurb: string;
};

export const BADGES: Badge[] = [
  { id: "b5", threshold: 5, name: "Rookie", emoji: "🥉", blurb: "Spot 5 cars" },
  { id: "b15", threshold: 15, name: "Elite", emoji: "🥈", blurb: "Spot 15 cars" },
  { id: "b30", threshold: 30, name: "Legendary", emoji: "🥇", blurb: "Spot 30 cars" },
  { id: "b100", threshold: 100, name: "Diamond", emoji: "💎", blurb: "Spot 100 cars" },
];

export function badgesFor(total: number) {
  return BADGES.map((b) => ({ ...b, earned: total >= b.threshold }));
}

// ---------------- Daily goals ----------------
export type Goal = { id: string; label: string };
type GoalDef = Goal & { check: (c: CarReport) => boolean };

// largest number (3+ digits) found in a string, commas stripped
function bigNum(s: string): number {
  const m = (s || "").replace(/,/g, "").match(/\d{3,}/g);
  return m ? Math.max(...m.map(Number)) : 0;
}
function carValue(c: CarReport): number {
  const timeline = (c.valueTimeline || []).map((p) => p.usd || 0);
  return Math.max(0, ...timeline, c.goodDealUsd || 0, bigNum(c.priceRangeUsed));
}
function startYear(c: CarReport): number {
  const m = (c.yearRange || "").match(/\d{4}/g);
  return m ? Math.min(...m.map(Number)) : 0;
}

const GOAL_POOL: GoalDef[] = [
  { id: "v175k", label: "Spot a car worth over $175,000", check: (c) => carValue(c) >= 175000 },
  {
    id: "suvv8",
    label: "Spot an SUV with a V8 engine",
    check: (c) => /suv|crossover/i.test(c.bodyStyle) && /v[\s-]?8|8[\s-]?cyl/i.test(c.engine),
  },
  { id: "hp500", label: "Spot a car with over 500 hp", check: (c) => bigNum(c.horsepower) >= 500 },
  {
    id: "conv",
    label: "Spot a convertible",
    check: (c) => /convertible|cabriolet|roadster|spider|spyder|drop[\s-]?top/i.test(c.bodyStyle),
  },
  {
    id: "ev",
    label: "Spot an electric car",
    check: (c) => /electric|battery|\bev\b/i.test(c.engine) || /electric/i.test(c.drivetrain),
  },
  { id: "classic", label: "Spot a car older than 1995", check: (c) => startYear(c) > 0 && startYear(c) < 1995 },
  { id: "german", label: "Spot a German car", check: (c) => /german|germany/i.test(c.countryOfOrigin) },
  { id: "v12", label: "Spot a car with a V12 engine", check: (c) => /v[\s-]?12|12[\s-]?cyl/i.test(c.engine) },
  { id: "rare70", label: "Spot a rare car (rarity 70+)", check: (c) => (c.rarityScore || 0) >= 70 },
  { id: "red", label: "Spot a red car", check: (c) => /\bred\b|crimson|scarlet|burgundy/i.test(c.color) },
  { id: "truck", label: "Spot a pickup truck", check: (c) => /pick[\s-]?up|truck/i.test(c.bodyStyle) },
  { id: "jdm", label: "Spot a Japanese car", check: (c) => /japan/i.test(c.countryOfOrigin) },
  { id: "italian", label: "Spot an Italian car", check: (c) => /ital/i.test(c.countryOfOrigin) },
  { id: "awd", label: "Spot an all-wheel-drive car", check: (c) => /awd|all[\s-]?wheel|4wd|quattro/i.test(c.drivetrain) },
];

// Deterministic per-day pick of two distinct goals.
function hashDate(d: string): number {
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return h;
}

export function goalsForDate(date: string): GoalDef[] {
  const h = hashDate(date);
  const i1 = h % GOAL_POOL.length;
  let i2 = Math.floor(h / GOAL_POOL.length) % GOAL_POOL.length;
  if (i2 === i1) i2 = (i2 + 1) % GOAL_POOL.length;
  return [GOAL_POOL[i1], GOAL_POOL[i2]];
}

export function evaluateGoals(car: CarReport, goals: GoalDef[]): string[] {
  return goals
    .filter((g) => {
      try {
        return g.check(car);
      } catch {
        return false;
      }
    })
    .map((g) => g.id);
}

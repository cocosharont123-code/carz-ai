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
function zeroToSixty(c: CarReport): number {
  const m = (c.zeroToSixty || "").match(/\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

// Hard, aspirational daily goals — hypercars, exotic engines, extreme numbers.
const GOAL_POOL: GoalDef[] = [
  { id: "v1m", label: "Spot a car worth over $1,000,000", check: (c) => carValue(c) >= 1_000_000 },
  { id: "v500k", label: "Spot a car worth over $500,000", check: (c) => carValue(c) >= 500_000 },
  { id: "hyper2m", label: "Spot a hypercar worth $2,000,000+", check: (c) => carValue(c) >= 2_000_000 },
  { id: "v12", label: "Spot a car with a V12 engine", check: (c) => /v[\s-]?12|12[\s-]?cyl/i.test(c.engine) },
  { id: "v10", label: "Spot a car with a V10 engine", check: (c) => /v[\s-]?10|10[\s-]?cyl/i.test(c.engine) },
  { id: "w16", label: "Spot a car with a W16 engine", check: (c) => /w[\s-]?16/i.test(c.engine) },
  { id: "hp700", label: "Spot a car with over 700 hp", check: (c) => bigNum(c.horsepower) >= 700 },
  { id: "hp1000", label: "Spot a car with over 1,000 hp", check: (c) => bigNum(c.horsepower) >= 1000 },
  { id: "rare85", label: "Spot an extremely rare car (rarity 85+)", check: (c) => (c.rarityScore || 0) >= 85 },
  { id: "ultra", label: "Spot an ultra-rare car (rarity 100+)", check: (c) => (c.rarityScore || 0) >= 100 },
  { id: "sub3", label: "Spot a car that does 0–60 under 3.0s", check: (c) => { const z = zeroToSixty(c); return z > 0 && z <= 3.0; } },
  { id: "top200", label: "Spot a car with a top speed over 200 mph", check: (c) => bigNum(c.topSpeed) >= 200 },
  { id: "prewar70", label: "Spot a classic older than 1970", check: (c) => startYear(c) > 0 && startYear(c) < 1970 },
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

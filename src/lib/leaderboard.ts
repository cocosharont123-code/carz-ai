import type { CarReport } from "./identify";

// Leaderboard + streaks backed by Upstash Redis.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function leaderboardConfigured(): boolean {
  return !!(REDIS_URL && REDIS_TOKEN);
}

async function cmd(args: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const r = await fetch(REDIS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()).result;
  } catch {
    return null;
  }
}

function bigNum(s: string): number {
  const m = (s || "").replace(/,/g, "").match(/\d{3,}/g);
  return m ? Math.max(...m.map(Number)) : 0;
}
function carValue(car: CarReport): number {
  const timeline = (car.valueTimeline || []).map((p) => p.usd || 0);
  return Math.max(0, ...timeline, car.goodDealUsd || 0, bigNum(car.priceRangeUsed));
}
function dayStr(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10);
}

// Points per spot = 1 base + a bonus that grows with your daily streak (capped).
const MAX_STREAK_BONUS = 10;
export function pointsForSpot(streak: number): number {
  return 1 + Math.min(Math.max(streak, 1), MAX_STREAK_BONUS);
}

type Profile = {
  name: string;
  image: string;
  spots: number;
  bestCar: string;
  bestValue: number;
  streak: number;
  lastActive: string;
  points: number;
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  image: string;
  points: number;
  spots: number;
  streak: number;
  bestCar: string;
  bestValue: number;
};

function emptyProfile(): Profile {
  return { name: "", image: "", spots: 0, bestCar: "", bestValue: 0, streak: 0, lastActive: "", points: 0 };
}

/** Record a spot for a signed-in user: updates streak, awards streak-boosted points. */
export async function recordSpot(
  user: { id: string; name?: string | null; image?: string | null },
  car: CarReport,
): Promise<void> {
  if (!leaderboardConfigured() || !user.id) return;
  try {
    const raw = (await cmd(["HGET", "lb:profile", user.id])) as string | null;
    const prof: Profile = raw ? { ...emptyProfile(), ...(JSON.parse(raw) as Profile) } : emptyProfile();
    prof.name = user.name || prof.name || "Spotter";
    prof.image = user.image || prof.image || "";

    if (car.isCar) {
      prof.spots += 1;
      const today = dayStr(0);
      // Advance the streak once per day.
      if (prof.lastActive !== today) {
        prof.streak = prof.lastActive === dayStr(1) ? (prof.streak || 0) + 1 : 1;
        prof.lastActive = today;
      }
      prof.points += pointsForSpot(prof.streak);

      const value = carValue(car);
      if (value > (prof.bestValue || 0)) {
        prof.bestValue = value;
        prof.bestCar = `${car.make} ${car.model} ${car.yearRange}`.trim();
        await cmd(["ZADD", "lb:bestcar", value, user.id]);
      }
    }

    await cmd(["HSET", "lb:profile", user.id, JSON.stringify(prof)]);
    await cmd(["ZADD", "lb:points", prof.points, user.id]); // rank by points
  } catch {
    // never break identification
  }
}

async function profilesFor(ids: string[]): Promise<Record<string, Profile>> {
  const out: Record<string, Profile> = {};
  for (const id of ids) {
    const raw = (await cmd(["HGET", "lb:profile", id])) as string | null;
    if (raw) {
      try {
        out[id] = { ...emptyProfile(), ...(JSON.parse(raw) as Profile) };
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

/** Top users ranked by streak-boosted points. */
export async function topSpotters(n = 20): Promise<LeaderboardEntry[]> {
  if (!leaderboardConfigured()) return [];
  const res = (await cmd(["ZREVRANGE", "lb:points", 0, n - 1, "WITHSCORES"])) as string[] | null;
  if (!Array.isArray(res)) return [];
  const ids: string[] = [];
  const points: Record<string, number> = {};
  for (let i = 0; i < res.length; i += 2) {
    ids.push(res[i]);
    points[res[i]] = Number(res[i + 1]);
  }
  const profs = await profilesFor(ids);
  return ids.map((id, i) => {
    const p = profs[id] ?? emptyProfile();
    return {
      rank: i + 1,
      name: p.name || "Spotter",
      image: p.image || "",
      points: points[id] ?? p.points,
      spots: p.spots,
      streak: p.streak,
      bestCar: p.bestCar || "",
      bestValue: p.bestValue || 0,
    };
  });
}

/** Current signed-in user's own streak/points/spots. */
export async function getMyStats(email: string): Promise<{ streak: number; points: number; spots: number }> {
  if (!leaderboardConfigured() || !email) return { streak: 0, points: 0, spots: 0 };
  const raw = (await cmd(["HGET", "lb:profile", email])) as string | null;
  if (!raw) return { streak: 0, points: 0, spots: 0 };
  try {
    const p = { ...emptyProfile(), ...(JSON.parse(raw) as Profile) };
    // streak is broken if last active wasn't today or yesterday
    const live = p.lastActive === dayStr(0) || p.lastActive === dayStr(1) ? p.streak : 0;
    return { streak: live, points: p.points, spots: p.spots };
  } catch {
    return { streak: 0, points: 0, spots: 0 };
  }
}

/** The single best (highest-value) car spotted by anyone. */
export async function bestCarOverall(): Promise<{ name: string; car: string; value: number } | null> {
  if (!leaderboardConfigured()) return null;
  const res = (await cmd(["ZREVRANGE", "lb:bestcar", 0, 0, "WITHSCORES"])) as string[] | null;
  if (!Array.isArray(res) || res.length < 2) return null;
  const raw = (await cmd(["HGET", "lb:profile", res[0]])) as string | null;
  if (!raw) return null;
  const p = JSON.parse(raw) as Profile;
  return { name: p.name || "Spotter", car: p.bestCar || "a car", value: Number(res[1]) };
}

import type { CarReport } from "./identify";

// Online leaderboard backed by Upstash Redis (REST API). Free tier is plenty.
// Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Vercel's Upstash
// integration also exposes KV_REST_API_URL / KV_REST_API_TOKEN — both work).
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
    const j = await r.json();
    return j.result;
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

type Profile = {
  name: string;
  image: string;
  spots: number;
  bestCar: string;
  bestValue: number;
};

export type LeaderboardEntry = Profile & { rank: number };

/** Record a spot for a signed-in user. Safe no-op if Redis isn't configured. */
export async function recordSpot(
  user: { id: string; name?: string | null; image?: string | null },
  car: CarReport,
): Promise<void> {
  if (!leaderboardConfigured() || !user.id) return;
  try {
    const newSpots = car.isCar ? Number(await cmd(["ZINCRBY", "lb:spots", 1, user.id])) || 0 : 0;
    const raw = (await cmd(["HGET", "lb:profile", user.id])) as string | null;
    const prof: Profile = raw
      ? (JSON.parse(raw) as Profile)
      : { name: "", image: "", spots: 0, bestCar: "", bestValue: 0 };
    prof.name = user.name || prof.name || "Spotter";
    prof.image = user.image || prof.image || "";
    if (newSpots) prof.spots = newSpots;

    const value = carValue(car);
    if (car.isCar && value > (prof.bestValue || 0)) {
      prof.bestValue = value;
      prof.bestCar = `${car.make} ${car.model} ${car.yearRange}`.trim();
      await cmd(["ZADD", "lb:bestcar", value, user.id]);
    }
    await cmd(["HSET", "lb:profile", user.id, JSON.stringify(prof)]);
  } catch {
    // never let the leaderboard break identification
  }
}

async function profilesFor(ids: string[]): Promise<Record<string, Profile>> {
  const out: Record<string, Profile> = {};
  for (const id of ids) {
    const raw = (await cmd(["HGET", "lb:profile", id])) as string | null;
    if (raw) {
      try {
        out[id] = JSON.parse(raw) as Profile;
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

/** Top spotters ranked by total cars spotted. */
export async function topSpotters(n = 20): Promise<LeaderboardEntry[]> {
  if (!leaderboardConfigured()) return [];
  const res = (await cmd(["ZREVRANGE", "lb:spots", 0, n - 1, "WITHSCORES"])) as string[] | null;
  if (!Array.isArray(res)) return [];
  const ids: string[] = [];
  const scores: Record<string, number> = {};
  for (let i = 0; i < res.length; i += 2) {
    ids.push(res[i]);
    scores[res[i]] = Number(res[i + 1]);
  }
  const profs = await profilesFor(ids);
  return ids.map((id, i) => {
    const p = profs[id] ?? { name: "Spotter", image: "", spots: scores[id], bestCar: "", bestValue: 0 };
    return { rank: i + 1, name: p.name || "Spotter", image: p.image || "", spots: scores[id] ?? p.spots, bestCar: p.bestCar || "", bestValue: p.bestValue || 0 };
  });
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

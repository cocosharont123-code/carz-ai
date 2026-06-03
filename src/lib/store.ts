import fs from "fs";
import path from "path";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { PLANS, type PlanId, type Plan } from "./plans";

// Simple JSON-file store with an in-memory cache. On serverless (Vercel) the
// project dir is read-only, so we fall back to /tmp + the memory cache (which
// persists for the life of a warm instance). Swap for a real DB in production.
const DATA_DIR = process.env.VERCEL
  ? "/tmp/car-spotter-data"
  : path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
export const UID_COOKIE = "cs_uid";
// Plan is also mirrored into a cookie so it stays consistent across Vercel's
// stateless serverless instances (the file/memory store is per-instance only).
export const PLAN_COOKIE = "cs_plan";

export function isPlanId(s: string | null | undefined): s is PlanId {
  return s === "free" || s === "pro" || s === "max";
}

let memory: Store | null = null;

export type HistoryItem = {
  make: string;
  model: string;
  yearRange: string;
  date: string;
};

export type UserRecord = {
  plan: PlanId;
  usage: Record<string, number>; // date -> count
  history: HistoryItem[];
  totalSpots: number; // lifetime cars identified (for badges)
  goalsDone: Record<string, string[]>; // date -> completed goal ids
};

type Store = { users: Record<string, UserRecord> };

function loadStore(): Store {
  if (memory) return memory;
  try {
    memory = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Store;
  } catch {
    memory = { users: {} };
  }
  return memory;
}

function saveStore(store: Store) {
  memory = store;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // Read-only filesystem (serverless) — the in-memory cache still serves
    // this warm instance. Persistence needs a real DB; see README.
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Resolve the current user id from the cookie, creating one if needed. */
export async function getUserId(): Promise<{ id: string; isNew: boolean }> {
  const jar = await cookies();
  const existing = jar.get(UID_COOKIE)?.value;
  if (existing) return { id: existing, isNew: false };
  return { id: "u_" + randomUUID(), isNew: true };
}

function ensureUser(store: Store, id: string): UserRecord {
  if (!store.users[id]) {
    store.users[id] = { plan: "free", usage: {}, history: [], totalSpots: 0, goalsDone: {} };
  }
  const u = store.users[id];
  u.plan = u.plan ?? "free";
  u.usage = u.usage ?? {};
  u.history = u.history ?? [];
  u.totalSpots = u.totalSpots ?? 0;
  u.goalsDone = u.goalsDone ?? {};
  return u;
}

export function getUser(id: string): UserRecord {
  const store = loadStore();
  return ensureUser(store, id);
}

export function usageToday(user: UserRecord): number {
  return user.usage[todayStr()] ?? 0;
}

export type PlanStatus = {
  plan: PlanId;
  planName: string;
  dailyLimit: number | null;
  usedToday: number;
  remainingToday: number | null;
  premiumReport: boolean;
  saveHistory: boolean;
  hotspotsMap: boolean;
  aiAssistant: boolean;
};

export function planStatusFor(planId: PlanId, user: UserRecord): PlanStatus {
  const plan: Plan = PLANS[planId] ?? PLANS.free;
  const used = usageToday(user);
  const limit = plan.dailyLimit;
  return {
    plan: plan.id,
    planName: plan.name,
    dailyLimit: limit,
    usedToday: used,
    remainingToday: limit === null ? null : Math.max(0, limit - used),
    premiumReport: plan.premiumReport,
    saveHistory: plan.saveHistory,
    hotspotsMap: plan.hotspotsMap,
    aiAssistant: plan.aiAssistant,
  };
}

export function planStatus(user: UserRecord): PlanStatus {
  return planStatusFor(user.plan, user);
}

export function atLimitFor(planId: PlanId, user: UserRecord): boolean {
  const plan = PLANS[planId] ?? PLANS.free;
  if (plan.dailyLimit === null) return false;
  return usageToday(user) >= plan.dailyLimit;
}

export function atLimit(user: UserRecord): boolean {
  return atLimitFor(user.plan, user);
}

export function recordIdentification(
  id: string,
  car: { make?: string; model?: string; yearRange?: string; isCar?: boolean },
  completedGoalIds: string[] = [],
  planOverride?: PlanId,
) {
  const store = loadStore();
  const user = ensureUser(store, id);
  const plan = PLANS[planOverride ?? user.plan] ?? PLANS.free;
  const today = todayStr();
  user.usage[today] = usageToday(user) + 1;
  if (car.isCar) {
    user.totalSpots = (user.totalSpots ?? 0) + 1;
  }
  if (plan.saveHistory && car.isCar) {
    user.history.push({
      make: car.make ?? "",
      model: car.model ?? "",
      yearRange: car.yearRange ?? "",
      date: today,
    });
    user.history = user.history.slice(-100);
  }
  if (completedGoalIds.length) {
    const merged = new Set([...(user.goalsDone[today] ?? []), ...completedGoalIds]);
    user.goalsDone[today] = Array.from(merged);
  }
  saveStore(store);
  return planStatusFor(planOverride ?? user.plan, user);
}

export function setPlan(id: string, plan: PlanId): PlanStatus {
  const store = loadStore();
  const user = ensureUser(store, id);
  user.plan = plan;
  saveStore(store);
  return planStatus(user);
}

export function recentHistory(user: UserRecord, n = 20): HistoryItem[] {
  return user.history.slice(-n).reverse();
}

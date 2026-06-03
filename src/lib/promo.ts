import type { PlanId } from "./plans";

// Promo codes -> the plan they unlock for free.
// Codes are matched case-insensitively (trimmed).
export const PROMO_CODES: Record<string, PlanId> = {
  "CARZ.100": "max",
};

export function planForCode(code: string): PlanId | null {
  const normalized = (code || "").trim().toUpperCase();
  return PROMO_CODES[normalized] ?? null;
}

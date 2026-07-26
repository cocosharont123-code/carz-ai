// Carz+ promo codes → percentage off. Matched case-insensitively.
// Shared by the pricing/membership UI (to show the discounted price) and the
// membership API (to validate redemptions server-side).
export const PROMOS: Record<string, number> = {
  "carz+100": 100, // 100% off — unlocks Carz+ free
  fleaxus: 25, // 25% off
};

export interface Promo {
  code: string; // normalized (lowercase)
  percentOff: number;
}

/** Look up a promo code (case-insensitive). Returns null if unknown. */
export function lookupPromo(raw: string): Promo | null {
  const code = (raw || "").trim().toLowerCase();
  const percentOff = PROMOS[code];
  return percentOff === undefined ? null : { code, percentOff };
}

/** Apply a percentage discount to a price, never below zero. */
export function applyDiscount(price: number, percentOff: number): number {
  return Math.max(0, price * (1 - percentOff / 100));
}

/** Format a price: whole numbers plain, otherwise two decimals. */
export function formatPrice(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

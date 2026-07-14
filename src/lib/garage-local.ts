// On-device spotting history ("Garage"). Stored in the browser via localStorage,
// so it works with no database and no sign-in. Persists per-browser/device.

export type GarageCar = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  image: string; // small base64 thumbnail
  confidence: string;
  rarityScore: number;
  priceRange: string;
  ts: number;
};

const KEY = "carz_garage_v1";
const MAX = 60; // cap to stay well under the ~5MB localStorage budget

export function getGarage(): GarageCar[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GarageCar[]) : [];
  } catch {
    return [];
  }
}

function write(cars: GarageCar[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cars));
    return true;
  } catch {
    return false;
  }
}

// Save a newly-identified car to the front of the history.
// Trims oldest entries (and, if storage is full, drops more) so it always fits.
export function addToGarage(car: Omit<GarageCar, "id" | "ts">): GarageCar[] {
  if (typeof window === "undefined") return [];
  const entry: GarageCar = {
    ...car,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  };
  let cars = [entry, ...getGarage()].slice(0, MAX);
  // If the quota is exceeded, keep dropping the oldest until it fits.
  while (cars.length > 1 && !write(cars)) {
    cars = cars.slice(0, cars.length - 1);
  }
  if (cars.length === 1) write(cars);
  return cars;
}

export function removeFromGarage(id: string): GarageCar[] {
  const cars = getGarage().filter((c) => c.id !== id);
  write(cars);
  return cars;
}

export function clearGarage(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

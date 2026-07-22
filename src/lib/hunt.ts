// Car Hunt Miami — a wanted board of rare cars with cash bounties.
// Join the hunt, then spot the cars live (camera only) to claim rewards.

export type WantedCar = {
  id: string;
  name: string;
  short: string;
  bounty: number;
  emoji: string;
  test: (s: string) => boolean;
};

export const HUNT_CITY = "Miami";

export const WANTED: WantedCar[] = [
  { id: "laferrari", name: "Ferrari LaFerrari", short: "LaFerrari", bounty: 900, emoji: "🔴", test: (s) => /laferrari|la\s*ferrari/.test(s) },
  { id: "chiron", name: "Bugatti Chiron", short: "Chiron", bounty: 800, emoji: "🔷", test: (s) => /chiron/.test(s) },
  { id: "huayra", name: "Pagani Huayra", short: "Huayra", bounty: 800, emoji: "⚪", test: (s) => /huayra/.test(s) },
  { id: "carreragt", name: "Porsche Carrera GT", short: "Carrera GT", bounty: 450, emoji: "🩶", test: (s) => /carrera\s*gt/.test(s) },
  { id: "lfa", name: "Lexus LFA", short: "LFA", bounty: 450, emoji: "⚪", test: (s) => /\blfa\b|lexus\s*lfa/.test(s) },
  { id: "senna", name: "McLaren Senna", short: "Senna", bounty: 450, emoji: "🟠", test: (s) => /\bsenna\b/.test(s) },
  { id: "fordgt", name: "Ford GT", short: "Ford GT", bounty: 400, emoji: "🔵", test: (s) => /ford\s*gt/.test(s) },
  { id: "r34", name: "Nissan Skyline R34 GT-R", short: "Skyline R34 GT-R", bounty: 250, emoji: "🔵", test: (s) => /\br34\b|skyline.*gt-?r|gt-?r.*r34/.test(s) },
  { id: "supra", name: "Toyota Supra (MK4)", short: "MK4 Supra", bounty: 200, emoji: "🟠", test: (s) => /supra/.test(s) },
  { id: "testarossa", name: "Ferrari Testarossa", short: "Testarossa", bounty: 250, emoji: "🔴", test: (s) => /testarossa/.test(s) },
];

export function matchWanted(make: string, model: string): WantedCar | null {
  const s = `${make} ${model}`.toLowerCase();
  return WANTED.find((w) => w.test(s)) ?? null;
}

// --- On-device hunt progress (localStorage) ---

const KEY = "carz_hunt_v1";

export type HuntState = { joined: boolean; claimed: Record<string, number> };

export function getHunt(): HuntState {
  if (typeof window === "undefined") return { joined: false, claimed: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { joined: !!p.joined, claimed: p.claimed || {} };
    }
  } catch {
    /* ignore */
  }
  return { joined: false, claimed: {} };
}

function save(s: HuntState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function joinHunt(): HuntState {
  const s = getHunt();
  s.joined = true;
  save(s);
  return s;
}

export function claimCar(id: string): HuntState {
  const s = getHunt();
  if (!s.claimed[id]) s.claimed[id] = Date.now();
  save(s);
  return s;
}

export function totalEarned(s: HuntState): number {
  return WANTED.reduce((t, w) => t + (s.claimed[w.id] ? w.bounty : 0), 0);
}

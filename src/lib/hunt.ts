// Car Hunt Miami — a wanted board of rare cars with cash bounties.
// Join the hunt, then spot the cars live (camera only) to claim rewards.

export type WantedCar = {
  id: string;
  name: string;
  short: string;
  bounty: number;
  emoji: string;
  colorLabel: string; // required color shown on the board
  test: (s: string) => boolean;
  colorTest: (color: string) => boolean; // true = the spotted color qualifies
};

export const HUNT_CITY = "Miami";

// Every hunt car must be spotted out on a public road.
export const HUNT_RULE = "All cars must be spotted out on the road.";

export const WANTED: WantedCar[] = [
  { id: "laferrari", name: "Ferrari LaFerrari", short: "LaFerrari", bounty: 900, emoji: "🟢", colorLabel: "Green only", test: (s) => /laferrari|la\s*ferrari/.test(s), colorTest: (c) => /green|emerald|lime|british\s*racing/.test(c) },
  { id: "chiron", name: "Bugatti Chiron", short: "Chiron", bounty: 800, emoji: "⚫", colorLabel: "Full carbon", test: (s) => /chiron/.test(s), colorTest: (c) => /carbon|black|exposed/.test(c) },
  { id: "huayra", name: "Pagani Huayra", short: "Huayra", bounty: 800, emoji: "🟡", colorLabel: "Yellow only", test: (s) => /huayra/.test(s), colorTest: (c) => /yellow|gold/.test(c) },
  { id: "carreragt", name: "Porsche Carrera GT", short: "Carrera GT", bounty: 450, emoji: "🩶", colorLabel: "Grey only", test: (s) => /carrera\s*gt/.test(s), colorTest: (c) => /gr[ae]y|silver|gunmetal|graphite/.test(c) },
  { id: "lfa", name: "Lexus LFA", short: "LFA", bounty: 450, emoji: "⚪", colorLabel: "White only", test: (s) => /\blfa\b|lexus\s*lfa/.test(s), colorTest: (c) => /white|pearl|ivory/.test(c) },
  { id: "senna", name: "McLaren Senna", short: "Senna", bounty: 450, emoji: "🟠", colorLabel: "Orange only", test: (s) => /\bsenna\b/.test(s), colorTest: (c) => /orange|amber/.test(c) },
  { id: "fordgt", name: "Ford GT", short: "Ford GT", bounty: 400, emoji: "🔵", colorLabel: "Blue only", test: (s) => /ford\s*gt/.test(s), colorTest: (c) => /blue|navy|teal/.test(c) },
  { id: "r34", name: "Nissan Skyline R34 GT-R", short: "Skyline R34 GT-R", bounty: 250, emoji: "🔴", colorLabel: "Red only", test: (s) => /\br34\b|skyline.*gt-?r|gt-?r.*r34/.test(s), colorTest: (c) => /red|crimson|scarlet/.test(c) },
  { id: "supra", name: "Toyota Supra (MK4)", short: "MK4 Supra", bounty: 200, emoji: "🎨", colorLabel: "Any color", test: (s) => /supra/.test(s), colorTest: () => true },
  { id: "testarossa", name: "Ferrari Testarossa", short: "Testarossa", bounty: 250, emoji: "🎨", colorLabel: "Any color", test: (s) => /testarossa/.test(s), colorTest: () => true },
];

export function matchWanted(make: string, model: string): WantedCar | null {
  const s = `${make} ${model}`.toLowerCase();
  return WANTED.find((w) => w.test(s)) ?? null;
}

export function colorOk(car: WantedCar, color: string): boolean {
  return car.colorTest((color || "").toLowerCase());
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

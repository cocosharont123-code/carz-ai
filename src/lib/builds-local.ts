// Saved customizer builds ("Builds"). Same on-device model as the Garage:
// stored in localStorage, no database and no sign-in required.
// See garage-local.ts — this is the customized-render sibling of that store.
//
// The *config* of each build also lives server-side per Carz+ account (see
// config-history.ts), and entries share an `id` so the builds page can pair a
// synced config with the render still cached on this device. Renders are kept
// here rather than in the blob: base64 photos have no business in a shared JSON
// document, and they're cheap to regenerate.

export type SavedBuild = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  image: string; // small base64 thumbnail of the AI render
  // The chosen config, kept as display labels (not the prompt strings) so the
  // builds page can show it back without re-deriving anything.
  bodyColor?: string;
  bodyHex?: string;
  rimColor?: string;
  rimHex?: string;
  features: string[];
  ts: number;
};

const KEY = "carz_builds_v1";
const MAX = 24; // renders are heavier than spot thumbnails, so a tighter cap

export function getBuilds(): SavedBuild[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedBuild[]) : [];
  } catch {
    return [];
  }
}

function write(builds: SavedBuild[]): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(builds));
    return true;
  } catch {
    return false;
  }
}

// Save a freshly-rendered build to the front of the list. Pass the server's
// history id so the two records line up; falls back to a local id when the
// config history is unavailable.
// Trims oldest entries (and, if storage is full, drops more) so it always fits.
export function addBuild(build: Omit<SavedBuild, "id" | "ts"> & { id?: string }): SavedBuild[] {
  if (typeof window === "undefined") return [];
  const entry: SavedBuild = {
    ...build,
    id: build.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  };
  let builds = [entry, ...getBuilds()].slice(0, MAX);
  while (builds.length > 1 && !write(builds)) {
    builds = builds.slice(0, builds.length - 1);
  }
  if (builds.length === 1) write(builds);
  return builds;
}

export function removeBuild(id: string): SavedBuild[] {
  const builds = getBuilds().filter((b) => b.id !== id);
  write(builds);
  return builds;
}

export function clearBuilds(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

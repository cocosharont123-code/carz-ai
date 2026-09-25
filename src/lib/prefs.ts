/**
 * Everything the settings page can change, in one object.
 *
 * Preferences live in localStorage and are applied to <html> — as a class for
 * the theme, as data-* attributes for the on/off switches, and as plain custom
 * properties for the values CSS interpolates. Nothing here touches the server:
 * these are per-device, and a phone wanting reduced motion says nothing about
 * the same account on a desktop.
 */

export type Theme = "system" | "light" | "dark";
export type OnOff = "on" | "off";
export type Units = "km" | "mi";

export type Prefs = {
  theme: Theme;
  accent: string; // hex
  radius: number; // rem, drives the whole radius scale
  fontScale: number; // 0.9–1.25
  motion: "full" | "reduced";
  glass: OnOff; // backdrop blur on the glass surfaces
  glow: OnOff; // neon bloom shadows
  shader: OnOff; // the animated WebGL background
  photos: "bw" | "color";
  units: Units;
};

export const DEFAULTS: Prefs = {
  theme: "dark",
  accent: "#00e5ff",
  radius: 0.9,
  fontScale: 1,
  motion: "full",
  glass: "on",
  glow: "on",
  shader: "on",
  photos: "bw",
  units: "km",
};

export const KEY = "carz_prefs_v1";

export const ACCENTS: { name: string; hex: string }[] = [
  { name: "Neon blue", hex: "#00e5ff" },
  { name: "Acid green", hex: "#39ff14" },
  { name: "Signal red", hex: "#ff3131" },
  { name: "Amber", hex: "#ffbe0b" },
  { name: "Violet", hex: "#8338ec" },
  { name: "Hot pink", hex: "#ff006e" },
];

export const RADII: { name: string; value: number }[] = [
  { name: "Sharp", value: 0 },
  { name: "Slight", value: 0.45 },
  { name: "Soft", value: 0.9 },
  { name: "Round", value: 1.5 },
];

/**
 * Pick black or white text for a given accent.
 *
 * Relative luminance rather than a lookup table, so a custom hex from the colour
 * picker gets a readable label too — several of the presets (acid green, amber)
 * need dark text and the rest need light, and guessing wrong is unreadable.
 */
export function inkFor(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return "#04121a";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#0a0a0a" : "#ffffff";
}

export function isHex(v: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

/** Merge stored values over the defaults, dropping anything malformed. */
export function normalize(raw: unknown): Prefs {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Prefs>;
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

  return {
    theme: oneOf(p.theme, ["system", "light", "dark"] as const, DEFAULTS.theme),
    accent: typeof p.accent === "string" && isHex(p.accent) ? p.accent : DEFAULTS.accent,
    radius: num(p.radius, 0, 2, DEFAULTS.radius),
    fontScale: num(p.fontScale, 0.9, 1.25, DEFAULTS.fontScale),
    motion: oneOf(p.motion, ["full", "reduced"] as const, DEFAULTS.motion),
    glass: oneOf(p.glass, ["on", "off"] as const, DEFAULTS.glass),
    glow: oneOf(p.glow, ["on", "off"] as const, DEFAULTS.glow),
    shader: oneOf(p.shader, ["on", "off"] as const, DEFAULTS.shader),
    photos: oneOf(p.photos, ["bw", "color"] as const, DEFAULTS.photos),
    units: oneOf(p.units, ["km", "mi"] as const, DEFAULTS.units),
  };
}

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    return normalize(JSON.parse(window.localStorage.getItem(KEY) || "{}"));
  } catch {
    return DEFAULTS;
  }
}

export function savePrefs(p: Prefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode, or a full quota — the session still applies */
  }
}

/** Resolve "system" against the OS setting. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Write a set of preferences onto <html>. The single place that mutates it. */
export function applyPrefs(p: Prefs): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const dark = resolveTheme(p.theme) === "dark";

  el.classList.toggle("dark", dark);
  el.classList.toggle("light", !dark);
  // Lets form controls, scrollbars and the caret follow the theme.
  el.style.colorScheme = dark ? "dark" : "light";

  el.style.setProperty("--accent-hex", p.accent);
  el.style.setProperty("--accent-ink", inkFor(p.accent));
  el.style.setProperty("--radius", `${p.radius}rem`);
  el.style.setProperty("--font-scale", String(p.fontScale));

  el.dataset.motion = p.motion;
  el.dataset.glass = p.glass;
  el.dataset.glow = p.glow;
  el.dataset.shader = p.shader;
  el.dataset.photos = p.photos;
}

/** Distance in the unit the reader chose. */
export function formatDistance(km: number, units: Units): string {
  if (units === "mi") {
    const mi = km * 0.621371;
    if (mi < 1) return "under 1 mile away";
    return `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} miles away`;
  }
  if (km < 1) return "under 1 km away";
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

/**
 * The pre-paint script, inlined by the root layout.
 *
 * It repeats applyPrefs() rather than importing it because it has to run before
 * React exists — the whole point is that the first painted frame is already the
 * right theme, size and colour. Keep the two in step.
 */
export const BOOT_SCRIPT = `(function(){try{
var d=document.documentElement,s={};
try{s=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||"{}")||{}}catch(e){}
var t=s.theme==="light"||s.theme==="dark"||s.theme==="system"?s.theme:${JSON.stringify(DEFAULTS.theme)};
var dark=t==="system"?!window.matchMedia("(prefers-color-scheme: light)").matches:t==="dark";
d.classList.toggle("dark",dark);d.classList.toggle("light",!dark);d.style.colorScheme=dark?"dark":"light";
var a=typeof s.accent==="string"&&/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.accent)?s.accent:${JSON.stringify(DEFAULTS.accent)};
d.style.setProperty("--accent-hex",a);
var h=a.replace("#","");if(h.length===3){h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]}
var n=parseInt(h,16),c=[(n>>16)&255,(n>>8)&255,n&255].map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});
d.style.setProperty("--accent-ink",(0.2126*c[0]+0.7152*c[1]+0.0722*c[2])>0.45?"#0a0a0a":"#ffffff");
if(typeof s.radius==="number"){d.style.setProperty("--radius",Math.min(2,Math.max(0,s.radius))+"rem")}
if(typeof s.fontScale==="number"){d.style.setProperty("--font-scale",String(Math.min(1.25,Math.max(0.9,s.fontScale))))}
d.dataset.motion=s.motion==="reduced"?"reduced":"full";
d.dataset.glass=s.glass==="off"?"off":"on";
d.dataset.glow=s.glow==="off"?"off":"on";
d.dataset.shader=s.shader==="off"?"off":"on";
d.dataset.photos=s.photos==="color"?"color":"bw";
}catch(e){}})();`;

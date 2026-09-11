// The customizer's option tables. Shared by the client (which renders the
// swatches and sends the `value` strings) and the API route (which turns those
// values back into display labels for the saved config history), so the two can
// never drift apart.

export type ColorOption = { label: string; value: string; hex: string };
export type FeatureOption = { label: string; value: string };

export const RIM_COLORS: ColorOption[] = [
  { label: "Gloss Black", value: "gloss black", hex: "#14141b" },
  { label: "Chrome", value: "polished chrome", hex: "#d7dbe0" },
  { label: "Bronze", value: "matte bronze", hex: "#9a6a34" },
  { label: "Gold", value: "gold", hex: "#d4af37" },
  { label: "White", value: "gloss white", hex: "#f2f2ee" },
  { label: "Gunmetal", value: "gunmetal grey", hex: "#4a4e56" },
];

export function rimOption(value?: string): ColorOption | undefined {
  return value ? RIM_COLORS.find((c) => c.value === value) : undefined;
}

/* --- Any colour, named ----------------------------------------------------
 *
 * The body colour comes off a wheel now, so it is an arbitrary hex rather than
 * one of eleven presets. The image model is given words, not a swatch, so the
 * hex has to be turned back into a phrase a painter would recognise: "deep
 * azure", "pastel pink", "gunmetal grey".
 *
 * Lives here, next to the rim table, because the client names the colour for
 * the prompt and the API names it again for the saved build, and a second
 * implementation would eventually disagree with this one.
 */

/** Hue ranges in degrees, in the order a wheel runs through them. */
const HUES: { max: number; name: string }[] = [
  { max: 15, name: "red" },
  { max: 40, name: "orange" },
  { max: 52, name: "amber" },
  { max: 68, name: "yellow" },
  { max: 90, name: "lime" },
  { max: 150, name: "green" },
  { max: 175, name: "teal" },
  { max: 195, name: "cyan" },
  { max: 215, name: "azure" },
  { max: 250, name: "blue" },
  { max: 270, name: "indigo" },
  { max: 290, name: "violet" },
  { max: 320, name: "magenta" },
  { max: 345, name: "pink" },
  { max: 360, name: "red" },
];

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return { h: (h + 360) % 360, s, l };
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** A hex, as a display label and as a phrase for the image prompt. */
export function describeColor(hex: string): { label: string; value: string } {
  const { h, s, l } = hexToHsl(hex);

  // Greys first: a hue means nothing once the saturation is gone.
  // 0.12, not lower: a near-black with a tint of blue in it — the old
  // "Midnight" swatch was #14141b — reads as black to the eye, and naming it
  // "deep blue" to the image model gets back a car that is visibly blue.
  if (l < 0.12) return { label: "Midnight", value: "gloss midnight black" };
  if (l > 0.94 && s < 0.15) return { label: "Pearl white", value: "pearl white" };
  if (s < 0.1) {
    if (l < 0.32) return { label: "Charcoal", value: "matte charcoal grey" };
    if (l < 0.62) return { label: "Gunmetal", value: "gunmetal grey" };
    return { label: "Silver", value: "metallic silver" };
  }

  const hue = HUES.find((entry) => h < entry.max)?.name ?? "red";
  const tone =
    l < 0.26 ? "deep" :
    l > 0.78 ? "pastel" :
    s > 0.65 ? "vivid" : "muted";

  return {
    label: `${tone[0].toUpperCase()}${tone.slice(1)} ${hue}`,
    value: `${tone} ${hue}`,
  };
}

/* --- Typed mods ----------------------------------------------------------- */

/**
 * Free text into separate mod phrases.
 *
 * Split rather than sent whole because the prompt lists each change on its own
 * line, and one run-on sentence reads to the model as a single instruction.
 * Capped at eight, and each one short, for the same reason the old list was
 * eight buttons: past that the model starts dropping the later ones.
 */
export function parseMods(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((part) => part.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 8);
}

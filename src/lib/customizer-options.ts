// The customizer's option tables. Shared by the client (which renders the
// swatches and sends the `value` strings) and the API route (which turns those
// values back into display labels for the saved config history), so the two can
// never drift apart.

export type ColorOption = { label: string; value: string; hex: string };
export type FeatureOption = { label: string; value: string };

export const BODY_COLORS: ColorOption[] = [
  { label: "Miami Blue", value: "vivid Miami blue", hex: "#19b6d8" },
  { label: "Coral", value: "coral red", hex: "#ff5a5f" },
  { label: "Midnight", value: "gloss midnight black", hex: "#14141b" },
  { label: "Pearl White", value: "pearl white", hex: "#f2f2ee" },
  { label: "Silver", value: "metallic silver", hex: "#c7ccd2" },
  { label: "Racing Red", value: "racing red", hex: "#d61f26" },
  { label: "Sunburst", value: "bright sunburst yellow", hex: "#ffcf3a" },
  { label: "Matte Grey", value: "matte gunmetal grey", hex: "#5b5f66" },
  { label: "BR Green", value: "British racing green", hex: "#12452b" },
  { label: "Orange", value: "sunset orange", hex: "#ff7a1a" },
  { label: "Purple", value: "deep candy purple", hex: "#6b2fb3" },
];

export const RIM_COLORS: ColorOption[] = [
  { label: "Gloss Black", value: "gloss black", hex: "#14141b" },
  { label: "Chrome", value: "polished chrome", hex: "#d7dbe0" },
  { label: "Bronze", value: "matte bronze", hex: "#9a6a34" },
  { label: "Gold", value: "gold", hex: "#d4af37" },
  { label: "White", value: "gloss white", hex: "#f2f2ee" },
  { label: "Gunmetal", value: "gunmetal grey", hex: "#4a4e56" },
];

export const FEATURES: FeatureOption[] = [
  { label: "Lowered", value: "lower the ride height for an aggressive slammed stance" },
  { label: "Wider wheels", value: "fit wider, larger diameter aftermarket wheels" },
  { label: "Front splitter", value: "add a front lip splitter" },
  { label: "Rear wing", value: "add a rear wing spoiler" },
  { label: "Tinted windows", value: "add dark tinted windows" },
  { label: "Carbon hood", value: "add an exposed carbon-fibre hood" },
  { label: "Wide body", value: "add flared wide-body fenders" },
  { label: "Off-road", value: "lift it and fit chunky off-road tyres" },
];

export function bodyOption(value?: string): ColorOption | undefined {
  return value ? BODY_COLORS.find((c) => c.value === value) : undefined;
}

export function rimOption(value?: string): ColorOption | undefined {
  return value ? RIM_COLORS.find((c) => c.value === value) : undefined;
}

/** Prompt strings -> display labels, ignoring anything unrecognised. */
export function featureLabels(values: string[]): string[] {
  return FEATURES.filter((f) => values.includes(f.value)).map((f) => f.label);
}

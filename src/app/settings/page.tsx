"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PageMasthead } from "@/components/ui/editorial";
import { Switch } from "@/components/ui/switch";
import { usePrefs } from "@/components/prefs-provider";
import { ACCENTS, RADII, isHex, type Theme } from "@/lib/prefs";
import { clearGarage } from "@/lib/garage-local";
import { clearBuilds } from "@/lib/builds-local";
import { clearWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

/* --- small building blocks -------------------------------------------------- */

function Section({ title, blurb, children }: { title: string; blurb?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="display text-2xl">{title}</h2>
      {blurb && <p className="mt-1 text-[13px] opacity-70">{blurb}</p>}
      <div className="mt-4 divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface">
        {children}
      </div>
    </section>
  );
}

/** One setting: label and description on the left, control on the right. */
function Row({
  label,
  hint,
  children,
  stack,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  /** Put the control on its own line — for swatch grids and sliders. */
  stack?: boolean;
}) {
  return (
    <div className={cn("p-4", stack ? "space-y-3" : "flex items-center justify-between gap-4")}>
      <div className={stack ? "" : "min-w-0"}>
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="mt-0.5 text-xs opacity-65">{hint}</p>}
      </div>
      <div className={stack ? "" : "shrink-0"}>{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="inline-flex gap-1 rounded-full border border-hairline bg-surface p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "press inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              active ? "bg-carz text-carz-ink" : "opacity-70 hover:opacity-100",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --- page ------------------------------------------------------------------- */

export default function SettingsPage() {
  const { prefs, set, reset, ready } = usePrefs();
  const [cleared, setCleared] = useState("");
  // Holds half-typed hex while the field is being edited; null means "show the
  // stored accent". Derived rather than mirrored, so a preset click or a reset
  // shows up without an effect syncing two copies of the same value.
  const [draft, setDraft] = useState<string | null>(null);
  const custom = draft ?? prefs.accent;

  function wipe(what: "garage" | "builds" | "wishlist") {
    const label = { garage: "Garage", builds: "Builds", wishlist: "Wishlist" }[what];
    if (!window.confirm(`Clear your ${label} on this device? This can't be undone.`)) return;
    if (what === "garage") clearGarage();
    if (what === "builds") clearBuilds();
    if (what === "wishlist") clearWishlist();
    setCleared(`${label} cleared on this device.`);
  }

  const presetActive = ACCENTS.some((a) => a.hex.toLowerCase() === prefs.accent.toLowerCase());

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <PageMasthead eyebrow="Make it yours" title="Settings" />
        <p className="mt-3 text-sm opacity-70">
          Everything here is saved on this device, and applies the moment you change it.
        </p>

        <Section
          title="Theme"
          blurb="Dark is the house style. Light is fully supported — the neon just works harder."
        >
          <Row label="Colour scheme" hint="System follows your device's light and dark schedule.">
            <Segmented<Theme>
              value={prefs.theme}
              onChange={(theme) => set({ theme })}
              options={[
                { value: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" aria-hidden /> },
                { value: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" aria-hidden /> },
                { value: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" aria-hidden /> },
              ]}
            />
          </Row>
        </Section>

        <Section title="Accent" blurb="Drives every button, active tab, link and highlight in the app.">
          <Row label="Preset" hint="Six that suit the neon palette." stack>
            <div className="flex flex-wrap gap-2.5">
              {ACCENTS.map((a) => {
                const active = a.hex.toLowerCase() === prefs.accent.toLowerCase();
                return (
                  <button
                    key={a.hex}
                    onClick={() => {
                      setDraft(null);
                      set({ accent: a.hex });
                    }}
                    title={a.name}
                    aria-label={a.name}
                    aria-pressed={active}
                    className={cn(
                      "press flex h-9 w-9 items-center justify-center rounded-full border-2 transition",
                      active ? "border-foreground" : "border-hairline hover:border-hairline-strong",
                    )}
                    style={{ background: a.hex }}
                  >
                    {active && <Check className="h-4 w-4" style={{ color: "var(--accent-ink)" }} aria-hidden />}
                  </button>
                );
              })}
            </div>
          </Row>
          <Row label="Custom colour" hint="Any hex. The label colour on top is picked for contrast." stack>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={isHex(custom) ? custom : "#00e5ff"}
                onChange={(e) => {
                  setDraft(null);
                  set({ accent: e.target.value });
                }}
                aria-label="Pick a custom accent colour"
                className="h-10 w-14 cursor-pointer rounded-lg border border-hairline bg-transparent"
              />
              <input
                value={custom}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (isHex(e.target.value)) set({ accent: e.target.value.trim() });
                }}
                placeholder="#00e5ff"
                spellCheck={false}
                className="w-28 rounded-lg border border-hairline bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-hairline-strong"
              />
              {!presetActive && <span className="util-label opacity-60">Custom</span>}
            </div>
          </Row>
        </Section>

        <Section title="Shape & size" blurb="Corner radius and text size ripple through every surface.">
          <Row label="Corners" hint="Applies to cards, buttons, inputs and photos.">
            <Segmented
              value={String(prefs.radius)}
              onChange={(v) => set({ radius: Number(v) })}
              options={RADII.map((r) => ({ value: String(r.value), label: r.name }))}
            />
          </Row>
          <Row
            label={`Text size — ${Math.round(prefs.fontScale * 100)}%`}
            hint="Spacing scales with the type, so layouts stay proportional."
            stack
          >
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-60">90%</span>
              <input
                type="range"
                min={0.9}
                max={1.25}
                step={0.05}
                value={prefs.fontScale}
                onChange={(e) => set({ fontScale: Number(e.target.value) })}
                aria-label="Text size"
                className="h-2 w-full flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-carz"
              />
              <span className="text-xs opacity-60">125%</span>
            </div>
          </Row>
        </Section>

        <Section
          title="Effects & performance"
          blurb="Turning these off is the quickest way to make an older phone feel fast."
        >
          <Row label="Animated background" hint="The neon WebGL shader behind every page.">
            <Switch
              checked={prefs.shader === "on"}
              onCheckedChange={(on) => set({ shader: on ? "on" : "off" })}
              aria-label="Animated background"
            />
          </Row>
          <Row label="Glass blur" hint="Frosted panels. The heaviest effect in the app.">
            <Switch
              checked={prefs.glass === "on"}
              onCheckedChange={(on) => set({ glass: on ? "on" : "off" })}
              aria-label="Glass blur"
            />
          </Row>
          <Row label="Neon glow" hint="The bloom around buttons and rare-car cards.">
            <Switch
              checked={prefs.glow === "on"}
              onCheckedChange={(on) => set({ glow: on ? "on" : "off" })}
              aria-label="Neon glow"
            />
          </Row>
          <Row label="Reduce motion" hint="Stops the fades, rises and pulses. Your OS setting also wins on its own.">
            <Switch
              checked={prefs.motion === "reduced"}
              onCheckedChange={(on) => set({ motion: on ? "reduced" : "full" })}
              aria-label="Reduce motion"
            />
          </Row>
          <Row label="Photo style" hint="Car photography is black & white by default.">
            <Segmented
              value={prefs.photos}
              onChange={(photos) => set({ photos })}
              options={[
                { value: "bw", label: "Black & white" },
                { value: "color", label: "Colour" },
              ]}
            />
          </Row>
        </Section>

        <Section title="Units" blurb="Used wherever the app shows a distance.">
          <Row label="Distance" hint="Nearby spots and hotspots.">
            <Segmented
              value={prefs.units}
              onChange={(units) => set({ units })}
              options={[
                { value: "km", label: "Kilometres" },
                { value: "mi", label: "Miles" },
              ]}
            />
          </Row>
        </Section>

        <Section title="Account" blurb="Your name, picture and membership live with your account, not this device.">
          <Row label="Profile" hint="Username, display name and picture.">
            <Link href="/profile" className="press util-label rounded-full border border-hairline-strong px-4 py-2 transition hover:border-foreground">
              Edit
            </Link>
          </Row>
          <Row label="Carz+ membership" hint="Billing, streak and perks.">
            <Link href="/membership" className="press util-label rounded-full border border-hairline-strong px-4 py-2 transition hover:border-foreground">
              Manage
            </Link>
          </Row>
        </Section>

        <Section
          title="Data on this device"
          blurb="Your Garage, Builds and Wishlist are stored in this browser only — clearing them here does not touch your account."
        >
          <Row label="Garage" hint="Every car you have spotted on this device.">
            <button onClick={() => wipe("garage")} className="press util-label rounded-full border border-neon-red/40 px-4 py-2 text-neon-red transition hover:border-neon-red">
              Clear
            </button>
          </Row>
          <Row label="Builds" hint="Saved customizer renders.">
            <button onClick={() => wipe("builds")} className="press util-label rounded-full border border-neon-red/40 px-4 py-2 text-neon-red transition hover:border-neon-red">
              Clear
            </button>
          </Row>
          <Row label="Wishlist" hint="Auctions you have saved.">
            <button onClick={() => wipe("wishlist")} className="press util-label rounded-full border border-neon-red/40 px-4 py-2 text-neon-red transition hover:border-neon-red">
              Clear
            </button>
          </Row>
          <Row label="Reset all settings" hint="Back to dark, neon blue, soft corners and every effect on.">
            <button onClick={reset} className="press util-label rounded-full border border-hairline-strong px-4 py-2 transition hover:border-foreground">
              Reset
            </button>
          </Row>
        </Section>

        {cleared && (
          <p aria-live="polite" className="mt-4 rounded-xl border border-neon-green/40 bg-neon-green/10 p-3 text-sm text-ngreen">
            {cleared}
          </p>
        )}

        {!ready && <p className="mt-6 text-xs opacity-50">Loading your saved settings…</p>}
      </main>
    </>
  );
}

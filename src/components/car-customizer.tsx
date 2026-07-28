"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";

/**
 * Post-spot customizer: pick a body colour, rim finish and mods, then have the
 * AI re-render the exact photo the user took with those changes applied.
 */

const BODY_COLORS: { label: string; value: string; hex: string }[] = [
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

const RIM_COLORS: { label: string; value: string; hex: string }[] = [
  { label: "Gloss Black", value: "gloss black", hex: "#14141b" },
  { label: "Chrome", value: "polished chrome", hex: "#d7dbe0" },
  { label: "Bronze", value: "matte bronze", hex: "#9a6a34" },
  { label: "Gold", value: "gold", hex: "#d4af37" },
  { label: "White", value: "gloss white", hex: "#f2f2ee" },
  { label: "Gunmetal", value: "gunmetal grey", hex: "#4a4e56" },
];

const FEATURES: { label: string; value: string }[] = [
  { label: "Lowered", value: "lower the ride height for an aggressive slammed stance" },
  { label: "Wider wheels", value: "fit wider, larger diameter aftermarket wheels" },
  { label: "Front splitter", value: "add a front lip splitter" },
  { label: "Rear wing", value: "add a rear wing spoiler" },
  { label: "Tinted windows", value: "add dark tinted windows" },
  { label: "Carbon hood", value: "add an exposed carbon-fibre hood" },
  { label: "Wide body", value: "add flared wide-body fenders" },
  { label: "Off-road", value: "lift it and fit chunky off-road tyres" },
];

interface CarLike {
  make: string;
  model: string;
  yearRange: string;
}

// Shrink the source photo before sending: smaller upload + far fewer vision
// tokens for the image model = noticeably faster generation. 640px keeps plenty
// of detail for a car re-render.
function shrink(dataUrl: string, max = 640, quality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function CarCustomizer({ image, car }: { image: string; car: CarLike }) {
  const [bodyColor, setBodyColor] = useState<string>("");
  const [rimColor, setRimColor] = useState<string>("");
  const [features, setFeatures] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [needSignIn, setNeedSignIn] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const anyChange = !!bodyColor || !!rimColor || features.length > 0;

  function toggleFeature(v: string) {
    setFeatures((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]));
  }

  async function generate() {
    if (!anyChange || busy) return;
    setError("");
    setNeedSignIn(false);
    setBusy(true);
    setResult(null);
    try {
      const src = await shrink(image);
      const res = await fetch("/api/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: src,
          make: car.make,
          model: car.model,
          yearRange: car.yearRange,
          bodyColor: bodyColor || undefined,
          rimColor: rimColor || undefined,
          features,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        if (res.status === 401 || d?.needSignIn) setNeedSignIn(true);
        setError(d?.error || `Couldn't restyle (error ${res.status}).`);
        return;
      }
      setResult(d.image);
      if (typeof d.remaining === "number") setRemaining(d.remaining);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-foreground/10 pt-5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-carz">Customize this car</h3>
      <p className="mb-3 mt-1 text-sm opacity-70">
        Pick a look and the AI repaints your photo — same car, same shot, new style.
      </p>

      {/* Body colour */}
      <div className="mt-3">
        <div className="util-label opacity-60">Body colour</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {BODY_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setBodyColor((v) => (v === c.value ? "" : c.value))}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition",
                bodyColor === c.value ? "border-carz bg-carz/10" : "border-foreground/15 hover:border-foreground/35",
              )}
            >
              <span className="h-3.5 w-3.5 rounded-full border border-black/20" style={{ background: c.hex }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rims */}
      <div className="mt-4">
        <div className="util-label opacity-60">Rims</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {RIM_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setRimColor((v) => (v === c.value ? "" : c.value))}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition",
                rimColor === c.value ? "border-carz bg-carz/10" : "border-foreground/15 hover:border-foreground/35",
              )}
            >
              <span className="h-3.5 w-3.5 rounded-full border border-black/20" style={{ background: c.hex }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="mt-4">
        <div className="util-label opacity-60">Mods</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {FEATURES.map((f) => (
            <button
              key={f.value}
              onClick={() => toggleFeature(f.value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition",
                features.includes(f.value) ? "border-carz bg-carz/10 text-carz" : "border-foreground/15 hover:border-foreground/35",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={generate}
        disabled={!anyChange || busy}
        className="press mt-5 w-full rounded-2xl bg-carz py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-40"
      >
        {busy ? "Rendering your build…" : "Generate customized photo"}
      </button>
      {error && <p className="mt-2 text-sm text-nred">{error}</p>}
      {needSignIn && (
        <button
          onClick={() => signIn("google")}
          className="press mt-2 w-full rounded-xl border border-foreground/20 py-2.5 text-sm font-semibold transition hover:border-foreground/40"
        >
          Sign in with Google
        </button>
      )}
      {remaining !== null && (
        <p className="mt-2 text-center text-xs opacity-60">{remaining} of 3 customizations left today</p>
      )}

      {result && (
        <div className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-foreground/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result} alt={`Customized ${car.make} ${car.model}`} className="w-full" />
          </div>
          <div className="mt-2 flex gap-2">
            <a
              href={result}
              download={`carz-${car.make}-${car.model}.jpg`.toLowerCase().replace(/\s+/g, "-")}
              className="press flex-1 rounded-xl border border-foreground/15 py-2.5 text-center text-sm font-semibold transition hover:border-foreground/35"
            >
              Download
            </a>
            <button
              onClick={generate}
              disabled={busy}
              className="press flex-1 rounded-xl border border-foreground/15 py-2.5 text-sm font-semibold transition hover:border-foreground/35 disabled:opacity-40"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

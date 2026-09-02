"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { addBuild } from "@/lib/builds-local";
import { BODY_COLORS, RIM_COLORS, FEATURES, bodyOption, rimOption, featureLabels } from "@/lib/customizer-options";
import { Spinner } from "@/components/ui/editorial";
import { cn } from "@/lib/utils";

/**
 * Post-spot customizer: pick a body colour, rim finish and mods, then have the
 * AI re-render the exact photo the user took with those changes applied.
 */

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

type Quota = { used: number; freeRemaining: number; credits: number; available: number };
type Access = {
  configured: boolean;
  signedIn: boolean;
  member: boolean;
  cap: number;
  extraPriceUsd: number;
  quota: Quota | null;
};

export function CarCustomizer({ image, car }: { image: string; car: CarLike }) {
  const [bodyColor, setBodyColor] = useState<string>("");
  const [rimColor, setRimColor] = useState<string>("");
  const [features, setFeatures] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [needSignIn, setNeedSignIn] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyNotice, setBuyNotice] = useState("");

  const anyChange = !!bodyColor || !!rimColor || features.length > 0;

  // Membership and quota up front, so the gate shows before anyone picks
  // colours and finds out on submit that they can't render.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/customize", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Access) => {
        if (cancelled) return;
        setAccess(d);
        if (d.quota) setQuota(d.quota);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function buyExtra() {
    if (buying) return;
    setBuying(true);
    setBuyNotice("");
    try {
      const res = await fetch("/api/customize/credits", { method: "POST" });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setBuyNotice(d?.error || "Couldn't add a customization.");
        return;
      }
      setQuota(d.quota);
      // Says so plainly rather than implying a card was charged — there is no
      // payment provider wired in yet.
      setBuyNotice(
        d.charged === false
          ? "Added. Payment isn't connected yet, so nothing was charged."
          : "Added.",
      );
    } catch {
      setBuyNotice("Network error — nothing was added.");
    } finally {
      setBuying(false);
    }
  }

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
        if (d?.needMembership) setAccess((a) => ({ ...(a as Access), member: false }));
        if (d?.quota) setQuota(d.quota);
        setError(d?.error || `Couldn't restyle (error ${res.status}).`);
        return;
      }
      setResult(d.image);
      if (d.quota) setQuota(d.quota);
      // The config itself is already logged to the member's history by the API.
      // All that's left is caching the render against that same id.
      void cacheRender(d.image, d.historyId);
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Cache the render on this device under the server's history id, so Garage ->
   * Builds can pair the synced config with a picture. Best-effort and silent:
   * the config is safe server-side either way, so a full localStorage quota
   * only costs this device its thumbnail, and it is not worth telling anyone
   * about while they are looking at the render they asked for.
   */
  async function cacheRender(image: string, historyId?: string | null) {
    try {
      const body = bodyOption(bodyColor);
      const rim = rimOption(rimColor);
      const thumb = await shrink(image, 360, 0.55);
      addBuild({
        id: historyId ?? undefined,
        image: thumb,
        make: car.make,
        model: car.model,
        yearRange: car.yearRange,
        bodyColor: body?.label,
        bodyHex: body?.hex,
        rimColor: rim?.label,
        rimHex: rim?.hex,
        features: featureLabels(features),
      });
    } catch {
      /* the render stays on screen regardless */
    }
  }

  // Members only. Shown instead of the controls, so nobody picks a look and
  // then discovers on submit that it was never available to them.
  if (access && access.signedIn && !access.member) {
    return (
      <div className="mt-6 border-t border-black/15 pt-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-carz">Customize this car</h3>
        <div className="mt-3 rounded-2xl border border-black/15 bg-black/[0.04] p-5 text-center">
          <p className="text-sm font-bold">The customizer is a Carz+ feature</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-70">
            Members get {access.cap} AI repaints a day. Extras are $
            {access.extraPriceUsd.toFixed(2)} each.
          </p>
          <Link
            href="/pricing"
            className="press mt-4 inline-flex rounded-full bg-black px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
          >
            Get Carz+
          </Link>
        </div>
      </div>
    );
  }

  const cap = access?.cap ?? 3;
  const price = access?.extraPriceUsd ?? 0.5;
  const outOfQuota = !!quota && quota.available <= 0;

  return (
    <div className="mt-6 border-t border-black/15 pt-5">
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
                bodyColor === c.value ? "border-carz bg-carz/10" : "border-black/20 hover:border-black/40",
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
                rimColor === c.value ? "border-carz bg-carz/10" : "border-black/20 hover:border-black/40",
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
                features.includes(f.value) ? "border-carz bg-carz/10 text-carz" : "border-black/20 hover:border-black/40",
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
        aria-busy={busy || undefined}
        className="press mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-carz py-3 text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-40"
      >
        {busy && <Spinner className="h-4 w-4" />}
        {busy ? "Rendering your build…" : "Generate customized photo"}
      </button>
      {error && <p className="mt-2 text-sm text-nred">{error}</p>}
      {needSignIn && (
        <button
          onClick={() => signIn("google")}
          className="press mt-2 w-full rounded-xl border border-black/25 py-2.5 text-sm font-semibold transition hover:border-black/45"
        >
          Sign in with Google
        </button>
      )}
      {quota && (
        <div className="mt-2 text-center">
          <p className="text-xs opacity-60">
            {quota.freeRemaining} of {cap} left today
            {quota.credits > 0 && ` · ${quota.credits} extra`}
          </p>

          {/* Only offered once the free three are actually gone — selling an
              extra while one is still free would be taking money for nothing. */}
          {outOfQuota && (
            <div className="mt-3 rounded-2xl border border-black/15 bg-black/[0.04] p-4">
              <p className="text-[13px] font-bold">Out of customizations for today</p>
              <p className="mt-1 text-[13px] opacity-70">
                Get one more for ${price.toFixed(2)}, or come back tomorrow for {cap} more.
              </p>
              <button
                type="button"
                onClick={buyExtra}
                disabled={buying}
                aria-busy={buying || undefined}
                className="press mt-3 inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {buying && <Spinner className="h-3.5 w-3.5" />}
                {buying ? "Adding…" : `Add 1 for $${price.toFixed(2)}`}
              </button>
              {buyNotice && <p className="mt-2 text-[12px] opacity-70">{buyNotice}</p>}
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-black/15">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result} alt={`Customized ${car.make} ${car.model}`} className="w-full" />
          </div>
          <div className="mt-2 flex gap-2">
            <a
              href={result}
              download={`carz-${car.make}-${car.model}.jpg`.toLowerCase().replace(/\s+/g, "-")}
              className="press flex-1 rounded-xl border border-black/20 py-2.5 text-center text-sm font-semibold transition hover:border-black/40"
            >
              Download
            </a>
            <button
              onClick={generate}
              disabled={busy}
              className="press flex-1 rounded-xl border border-black/20 py-2.5 text-sm font-semibold transition hover:border-black/40 disabled:opacity-40"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

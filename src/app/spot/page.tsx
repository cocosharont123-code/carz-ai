"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus, Upload, Trash2, X, TrafficCone, Check, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button as GlassButton } from "@/components/ui/editorial";
import { ProgressiveFluxLoader } from "@/components/ui/progressive-flux-loader";
import { Input } from "@/components/ui/input";
import { useImageUpload } from "@/components/hooks/use-image-upload";
import { CarHotspotsMap } from "@/components/car-hotspots-map";
import { CarCustomizer } from "@/components/car-customizer";
import { ScanModePicker } from "@/components/scan-mode-picker";
import { VinPanel } from "@/components/vin-panel";
import { addToGarage } from "@/lib/garage-local";
import { normalizeVin, type VinFacts } from "@/lib/vin";
import { SCAN_MODE_META, type ScanMode } from "@/lib/scan-mode";
import { cn } from "@/lib/utils";
import type { CarReport } from "@/lib/identify";

type Status = {
  plan: string;
  planName: string;
  member?: boolean;
  dailyLimit: number | null;
  usedToday: number;
  remainingToday: number | null;
  premiumReport: boolean;
  saveHistory: boolean;
  hotspotsMap: boolean;
  apiConfigured?: boolean;
  history?: { make: string; model: string; yearRange: string; date: string }[];
  totalSpots?: number;
};

// Everything the VIN itself established, kept beside the car it describes so
// the result can show its working: the number, whether it proved itself, and
// what the standard positions decode to.
type VinResult = {
  vin: string;
  facts: VinFacts;
  corrected?: string;
  ambiguous?: string[];
  registrySource?: string;
  surface?: string;
};

// Phase labels tied to what the pipeline is actually doing: a wide look, then
// an independent second opinion, then a magnified read of the deciding detail.
const SCAN_PHASES = [
  { at: 0, label: "reading the photo" },
  { at: 20, label: "matching the shape" },
  { at: 42, label: "reading the badges" },
  { at: 64, label: "cross-checking" },
  { at: 82, label: "almost there" },
];

// The VIN pipeline does genuinely different work, so it says so rather than
// reusing labels about badges and body shapes that would be a lie here.
const VIN_PHASES = [
  { at: 0, label: "finding the plate" },
  { at: 22, label: "reading the characters" },
  { at: 46, label: "verifying the check digit" },
  { at: 68, label: "decoding the VIN" },
  { at: 86, label: "naming the car" },
];

// Two ways to identify a car: what it looks like, or the number stamped on it.
type SpotMode = "photo" | "vin";
const MODES: { id: SpotMode; label: string }[] = [
  { id: "photo", label: "Car photo" },
  { id: "vin", label: "VIN" },
];

/**
 * The scan reports no progress — /api/identify is a single call that either
 * answers or doesn't — so the bar is an elapsed-time estimate, not a
 * measurement. It approaches CEIL asymptotically and never reaches 100, because
 * claiming completion before the answer lands would be a lie the user can catch.
 * TAU is tuned to a roughly ten-second scan: ~63% of the ceiling at 7s, ~86% at
 * 14s, still climbing after that.
 */
const SCAN_CEILING = 94;
const SCAN_TAU_SECONDS = 7;

export function scanProgressAt(elapsedSeconds: number): number {
  return SCAN_CEILING * (1 - Math.exp(-elapsedSeconds / SCAN_TAU_SECONDS));
}

// The in-flight state of the identify button. Identification runs for several
// seconds, so this takes over the button's own footprint rather than sitting
// beside it — there is no doubt the scan is running.
function ScanningButton({
  progress,
  phases = SCAN_PHASES,
  hint = "Reading badges, lights and body lines — this takes a few seconds",
}: {
  progress: number;
  phases?: { at: number; label: string }[];
  hint?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-6"
      // The loader reads its palette from these, so the brand blue is applied
      // per instance rather than by editing the component.
      style={
        {
          "--flux-from": "#0a84ff",
          "--flux-to": "#00e5ff",
        } as React.CSSProperties
      }
    >
      <ProgressiveFluxLoader
        value={progress}
        phases={phases}
        className="max-w-none gap-4"
        textClassName="text-xl font-bold text-white sm:text-2xl"
        barClassName="h-3 bg-white/10"
      />
      <p className="mt-4 text-center text-xs opacity-60">{hint}</p>
    </div>
  );
}

/**
 * The one way a car gets into the garage.
 *
 * Identification used to file every scan automatically, which made the garage a
 * log rather than a collection. Now nothing is stored until this is pressed —
 * so a blurry shot, a misidentification, or a car someone scanned out of
 * curiosity doesn't end up in their album.
 *
 * Keyed on the car in the result, so the "saved" state resets by itself when a
 * new scan replaces it — no clearing to remember at the call site.
 */
function SaveToGarage({ car, image }: { car: CarReport; image: string }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (saved || busy) return;
    setBusy(true);
    setError("");
    try {
      // The album thumbnail is generated here rather than kept in memory from
      // the scan: localStorage holds roughly 5MB, and a full-size frame per car
      // would fill it inside a dozen saves.
      const thumb = image ? await downscale(image, 360, 0.55) : "";
      addToGarage({
        image: thumb,
        make: car.make,
        model: car.model,
        yearRange: car.yearRange,
        confidence: car.confidence,
        rarityScore: car.rarityScore,
        priceRange: car.priceRangeUsed,
      });
      setSaved(true);
    } catch {
      setError("Couldn't save that — your garage storage may be full.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={save}
        disabled={saved || busy}
        aria-busy={busy || undefined}
        className={cn(
          "press flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold transition",
          saved
            ? "cursor-default bg-black/[0.06] text-black/60"
            : "bg-black text-white hover:opacity-90 disabled:opacity-50",
        )}
      >
        {saved ? (
          <>
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Saved to garage
          </>
        ) : (
          <>
            <BookmarkPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
            {busy ? "Saving…" : "Save to garage"}
          </>
        )}
      </button>

      {saved && (
        <p className="mt-2 text-center text-[11px] uppercase tracking-wide opacity-50">
          <Link href="/garage" className="underline underline-offset-2 hover:opacity-80">
            View your garage
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-center text-[13px] font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

function downscale(dataUrl: string, max = 1280, quality = 0.85): Promise<string> {
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

async function objectUrlToDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((r) => r.blob());
  return await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(blob);
  });
}

function Spec({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="rounded-xl bg-black/[0.05] p-3">
      <div className="text-[11px] uppercase tracking-wide ">{k}</div>
      <div className="mt-0.5 font-semibold">{v}</div>
    </div>
  );
}

function fmtUsd(n: number): string {
  if (!n || n <= 0) return "";
  return "$" + Math.round(n).toLocaleString("en-US");
}

function RarityMeter({ score, reason }: { score: number; reason?: string }) {
  if (!score || score <= 0) return null;
  const raw = Math.max(0, Math.round(score));
  const ultra = raw >= 100;
  const bar = Math.min(100, raw); // meter fills to 100
  const label = ultra
    ? "Ultra rare"
    : raw >= 85
      ? "Extremely rare"
      : raw >= 70
        ? "Rare"
        : raw >= 45
          ? "Uncommon"
          : raw >= 20
            ? "Fairly common"
            : "Common";
  return (
    <div
      className={`mt-4 rounded-2xl p-4 ${
        ultra
          ? "bg-gradient-to-r from-neon-red/15 via-neon-green/10 to-neon-blue/15 shadow-[0_0_25px_-8px_rgba(57,255,20,0.7)]"
          : "bg-black/[0.04]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wide ">Rarity</span>
        <span className="text-sm font-bold">
          {raw}/100 · <span className={ultra ? "text-neon-red" : "text-neon-red"}>{label}</span>
        </span>
      </div>
      {/* A pure-black track punched a hole in the grey card. A tint of black
          reads as the same unfilled groove without the hard edge. */}
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/15">
        <div
          className={`h-full rounded-full ${
            ultra
              ? "bg-gradient-to-r from-neon-red via-neon-green to-neon-blue"
              : "bg-gradient-to-r from-neon-green via-neon-red to-neon-red"
          }`}
          style={{ width: `${bar}%` }}
        />
      </div>
      {reason && <p className="mt-2 text-sm ">{reason}</p>}
    </div>
  );
}

function ValueChart({ points }: { points: { year: string; usd: number }[] }) {
  const pts = (points || []).filter((p) => p && typeof p.usd === "number" && p.usd > 0);
  if (pts.length < 2) return null;
  const W = 520, H = 150, padX = 48, padY = 22;
  const vals = pts.map((p) => p.usd);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => padX + (i * (W - padX * 2)) / (pts.length - 1);
  const y = (v: number) => padY + (1 - (v - min) / span) * (H - padY * 2);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.usd)}`).join(" ");
  const area = `${line} L ${x(pts.length - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`;
  const trendUp = pts[pts.length - 1].usd >= pts[0].usd;
  const stroke = trendUp ? "#34d399" : "#f87171";
  return (
    <div className="mt-4 rounded-2xl bg-black/[0.04] p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wide ">
          Market value over time
        </span>
        <span className="text-sm font-semibold">
          {fmtUsd(pts[0].usd)} to {fmtUsd(pts[pts.length - 1].usd)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
        <defs>
          <linearGradient id="valfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#valfill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.usd)} r="3.5" fill={stroke} />
            <text x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
              {p.year}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

type Listing = { title: string; price: number; currency: string; image: string; url: string; location: string };

function fmtMoney(n: number, currency: string): string {
  if (!n || n <= 0) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return "$" + Math.round(n).toLocaleString("en-US");
  }
}

function InlineListings({ make, model, goodDealUsd }: { make: string; model: string; goodDealUsd: number }) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [items, setItems] = useState<Listing[]>([]);

  useEffect(() => {
    if (!make) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/listings?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setConfigured(d.configured !== false);
        setItems(Array.isArray(d.items) ? d.items : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [make, model]);

  if (!make) return null;
  const q = encodeURIComponent(`${make} ${model}`.trim());
  const fallback = [
    { name: "eBay Motors", url: `https://www.ebay.com/sch/i.html?_nkw=${q}&_sop=15` },
    { name: "Cars.com", url: `https://www.cars.com/shopping/results/?keyword=${q}&sort=list_price` },
    { name: "AutoTrader", url: `https://www.autotrader.com/cars-for-sale/all-cars?keyword=${q}` },
    { name: "Craigslist", url: `https://www.craigslist.org/search/cta?query=${q}&sort=priceasc` },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-neon-green/30 bg-neon-green/[0.06] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-neon-green">For sale now</span>
        {goodDealUsd > 0 && (
          <span className="text-sm font-semibold">
            Good deal: <span className="text-neon-green">under {fmtUsd(goodDealUsd)}</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-black/[0.05]" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((it, i) => {
            const isDeal = goodDealUsd > 0 && it.price > 0 && it.price <= goodDealUsd;
            return (
              <a
                key={i}
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 overflow-hidden rounded-xl bg-black/[0.04] p-2 ring-1 ring-black/[0.08] transition hover:bg-black/[0.07]"
              >
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-black/[0.06]" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{it.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-bold">{fmtMoney(it.price, it.currency)}</span>
                    {isDeal && (
                      <span className="rounded-full bg-neon-green/20 px-1.5 py-0.5 text-[10px] font-bold text-neon-green">
                        DEAL
                      </span>
                    )}
                  </div>
                  {it.location && <p className="mt-0.5 text-xs ">{it.location}</p>}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs ">
            {configured
              ? "No live listings found right now — try these searches:"
              : "Live listings aren’t connected yet — searching these instead:"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {fallback.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-black/[0.05] px-3 py-1.5 text-sm font-medium hover:bg-black/[0.09]"
              >
                {s.name}
              </a>
            ))}
          </div>
          {!configured && (
            <p className="mt-2 text-[11px] ">
              Add a free eBay App ID (EBAY_APP_ID) to show real listings right here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SpotPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [car, setCar] = useState<CarReport | null>(null);
  // The identification lands first; specs, rarity and values stream in behind it.
  const [specsPending, setSpecsPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState("");
  const [limitHit, setLimitHit] = useState(false);
  const [note, setNote] = useState("");
  const [spottedImage, setSpottedImage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<SpotMode>("photo");
  const [vinInput, setVinInput] = useState("");
  const [vinResult, setVinResult] = useState<VinResult | null>(null);
  // Mirrored from the picker purely so the loader can say which mode is
  // running — PRO is the slower one, and the wait makes more sense named.
  const [scanMode, setScanMode] = useState<ScanMode>("fast");

  const {
    previewUrl,
    fileName,
    fileInputRef,
    handleThumbnailClick,
    handleFileChange,
    handleRemove,
  } = useImageUpload();

  const isVin = mode === "vin";
  // What the typed VIN actually resolves to — spaces and dashes stripped, and
  // the three characters a VIN can't contain folded onto the ones they're
  // mistaken for. The count shown to the user has to be of this, not of the raw
  // input, or "17 characters" and "valid VIN" disagree.
  const typedVin = normalizeVin(vinInput);
  const canRun = isVin ? typedVin.length === 17 || !!previewUrl : !!previewUrl;
  const run = isVin ? identifyVin : identify;

  async function refresh() {
    const s = await fetch("/api/me").then((r) => r.json());
    setStatus(s);
    return s as Status;
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  // Advance the scan bar while a scan is in flight. The write happens in the
  // interval callback — an external event — not in the effect body. `identify`
  // resets the value back to 0 before it sets `loading`, so a re-scan starts
  // from the left rather than picking up where the last one stopped.
  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const id = setInterval(() => {
      setScanProgress(scanProgressAt((Date.now() - startedAt) / 1000));
    }, 120);
    return () => clearInterval(id);
  }, [loading]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        const fakeEvent = {
          target: { files: [file] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileChange(fakeEvent);
      }
    },
    [handleFileChange],
  );

  /**
   * The half of a report that follows from the car's name rather than from what
   * was photographed — specs, rarity, values. Shared by both scanners: a VIN
   * decode and a photo scan arrive at an identification by completely different
   * routes, but everything after the name is the same work.
   */
  function loadDetails(base: CarReport, rawImage: string) {
    setSpecsPending(true);
    return (async () => {
      try {
        const dres = await fetch("/api/identify/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            make: base.make,
            model: base.model,
            yearRange: base.yearRange,
            generation: base.generation,
            trimGuess: base.trimGuess,
          }),
        });
        const dd = await dres.json();
        if (!dd.specs) return;
        const full = { ...base, ...dd.specs };
        setCar(full);
        if (dd.status) setStatus((prev) => ({ ...(prev as Status), ...dd.status }));

        // Nothing is filed in the garage here — the garage is a collection the
        // spotter curates, so it only takes what they press Save on.

        // Submit to the global rarest-cars leaderboard (best-effort). Only with
        // a photo of the car: a VIN scan photographs a plate, and a leaderboard
        // of door jambs helps nobody.
        if (full.rarityScore > 0 && rawImage) {
          const lbThumb = await downscale(rawImage, 200, 0.5);
          void fetch("/api/leaderboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image: lbThumb,
              make: full.make,
              model: full.model,
              yearRange: full.yearRange,
              rarityScore: full.rarityScore,
              rarityReason: full.rarityReason,
              priceRange: full.priceRangeUsed,
            }),
          }).catch(() => {});
        }
      } catch {
        /* details are best-effort — the identification already landed */
      } finally {
        setSpecsPending(false);
      }
    })();
  }

  /**
   * Identify a car from its VIN rather than its bodywork.
   *
   * A typed VIN beats a photographed one whenever both are present: someone who
   * has typed all seventeen characters is doing it precisely because the plate
   * wouldn't photograph, and their reading of it is the better source.
   */
  async function identifyVin() {
    const typed = normalizeVin(vinInput);
    if (typed.length !== 17 && !previewUrl) {
      setError("Add a photo of the VIN plate, or type all 17 characters.");
      return;
    }
    setError("");
    setLimitHit(false);
    setVinResult(null);
    setScanProgress(0);
    setLoading(true);
    try {
      let payload: { vin?: string; image?: string };
      if (typed.length === 17) {
        payload = { vin: typed };
      } else {
        // Higher quality than a car scan for the same pixel budget: stamped
        // characters are exactly what JPEG ringing destroys, and one mangled
        // character is a different vehicle rather than a slightly worse guess.
        payload = { image: await downscale(await objectUrlToDataUrl(previewUrl!), 2048, 0.92) };
      }

      const res = await fetch("/api/vin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 402) {
        setLimitHit(true);
        if (data.status) setStatus((prev) => ({ ...(prev as Status), ...data.status }));
        return;
      }
      if (!res.ok) {
        setError(data.message || "Something went wrong.");
        return;
      }
      // A VIN that couldn't be read or decoded — the message says which, and
      // what to do about it.
      if (!data.ok) {
        setError(data.message || "Couldn't read that VIN.");
        return;
      }

      setCar(data.car);
      // No car photo here, so no customizer and no garage thumbnail: the image
      // that was uploaded is a picture of a plate.
      setSpottedImage("");
      setVinResult({
        vin: data.vin,
        facts: data.facts,
        corrected: data.corrected || undefined,
        ambiguous: data.ambiguous,
        registrySource: data.registrySource || undefined,
        surface: data.read?.surface,
      });
      setStatus((prev) => ({ ...(prev as Status), ...data.status }));
      if (data.car?.isCar) void loadDetails(data.car, "");
      await refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function identify() {
    if (!previewUrl) {
      setError("Attach a photo of a car first.");
      return;
    }
    setError("");
    setLimitHit(false);
    setScanProgress(0);
    setLoading(true);
    try {
      const raw = await objectUrlToDataUrl(previewUrl);
      // 2576px is the model's high-resolution limit — anything smaller throws
      // away the badge text and headlight detail the identification leans on.
      // At 1024/0.72 a Carrera 4S badge is a smudge; this is the single biggest
      // lever on accuracy, so it's worth the extra upload.
      // 2576px cost ~1MB, and on a phone that is encode time plus cellular
      // upload before the scan even starts — for pixels the wide-shot passes
      // never see, since the server works from a 1280px copy. Only the zoom
      // crop reads finer detail than that, and a badge cropped out of 2048px
      // still magnifies well past what the looks get. Roughly a third the bytes.
      const image = await downscale(raw, 2048, 0.88);
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, note }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setLimitHit(true);
        if (data.status) setStatus((prev) => ({ ...(prev as Status), ...data.status }));
        return;
      }
      if (!res.ok) {
        setError(data.message || "Something went wrong.");
        return;
      }
      setCar(data.car);
      setSpottedImage(image); // keep the exact photo for the AI customizer
      setStatus((prev) => ({ ...(prev as Status), ...data.status }));

      // The answer is on screen at this point. Everything below follows from the
      // car's name rather than the photo, so it loads in behind the result
      // instead of holding it up — including the garage and leaderboard entries,
      // which need the rarity and price that arrive with it.
      if (data.car?.isCar) void loadDetails(data.car, raw);
      // keep the photo on screen after identifying
      await refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function startNew() {
    handleRemove();
    setNote("");
    setCar(null);
    setSpottedImage("");
    setVinResult(null);
    setVinInput("");
    setError("");
  }

  // Switching scanners clears the last result: a car card from a photo scan
  // sitting under the VIN tab would look like it came from a VIN.
  function switchMode(next: SpotMode) {
    if (next === mode) return;
    startNew();
    setLimitHit(false);
    setMode(next);
  }


  return (
    <>
      <main className="mx-auto w-full max-w-2xl px-5 py-14">
        <div className="util-label ">Scan · identify · save</div>
        <h1 className="display mt-3 text-7xl">Spot a car</h1>
        <p className="mt-3 text-sm ">
          {isVin
            ? "Photograph the VIN plate and get the exact car it was built as."
            : "Drop in a photo, then hit identify."}
        </p>

        {/* The two ways in. A VIN is the car's own answer rather than a very
            good guess at it, so it sits beside the photo scanner as a peer
            instead of being buried somewhere in settings. */}
        <div className="mt-4 inline-flex gap-1 rounded-full border border-white/12 bg-white/[0.03] p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => switchMode(m.id)}
              aria-pressed={mode === m.id}
              className={cn(
                "util-label whitespace-nowrap rounded-full px-5 py-1.5 transition-colors",
                mode === m.id ? "bg-carz text-black" : "opacity-70 hover:opacity-100",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {status && (
          <p className="util-label mt-3 ">
            {status.member ? (
              <>Unlimited scans · {status.usedToday} today</>
            ) : (
              <>
                {Math.max(0, (status.dailyLimit ?? 3) - status.usedToday)} of {status.dailyLimit ?? 3} free scans
                left today ·{" "}
                <Link href="/pricing" className="underline underline-offset-2">
                  Get Carz+
                </Link>
              </>
            )}
          </p>
        )}

        {status && status.apiConfigured === false && (
          <div className="mt-4 rounded-xl border border-neon-red/50 bg-neon-red/10 p-3 text-sm text-neon-red">
            Server has no <code>ANTHROPIC_API_KEY</code> set — identification will fail until it&apos;s
            configured in <code>.env.local</code>. See the README.
          </div>
        )}


        {/* Upload card */}
        <div className="mt-6 space-y-4">
          <Input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          {!previewUrl ? (
            <div
              onClick={handleThumbnailClick}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex h-64 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-foreground/15 bg-foreground/[0.02] transition-colors hover:bg-foreground/[0.04]",
                isDragging && "border-neon-blue/60 bg-neon-blue/5",
              )}
            >
              <div className="rounded-full bg-background p-3 shadow-sm">
                <ImagePlus className="h-6 w-6 " />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isVin ? "Click to select a photo of the VIN" : "Click to select a car photo"}
                </p>
                <p className="text-xs ">
                  {isVin
                    ? "The plate at the base of the windscreen, or the door-jamb sticker"
                    : "or drag and drop it here"}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="group relative h-64 overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Car preview"
                  className="h-full w-full object-cover brightness-75 transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="sm" variant="secondary" onClick={handleThumbnailClick} className="h-9 w-9 p-0">
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleRemove} className="h-9 w-9 p-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {fileName && (
                <div className="mt-2 flex items-center gap-2 text-sm ">
                  <span className="truncate">{fileName}</span>
                  <button onClick={handleRemove} className="ml-auto rounded-full p-1 hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {isVin ? (
            <div>
              <Input
                value={vinInput}
                onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                placeholder="…or type the 17 characters"
                spellCheck={false}
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={25}
                className="font-mono tracking-[0.15em]"
                aria-label="VIN"
              />
              {/* Counts what the VIN actually is rather than what was typed:
                  spaces and dashes are stripped, and I/O/Q fold onto 1/0/0. */}
              {vinInput.trim() !== "" && (
                <p className="mt-1.5 text-xs opacity-60">
                  {typedVin.length === 17
                    ? "17 characters — this will be used instead of the photo."
                    : `${typedVin.length} of 17 characters.`}
                </p>
              )}
            </div>
          ) : (
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note: 'spotted downtown, looked rare…'"
            />
          )}

          {/* Only on the photo tab: a VIN read is a transcription, and the two
              modes are about how hard to look at a car's bodywork. Showing a
              control here that the VIN pipeline ignores would be a lie. */}
          {!isVin && !loading && <ScanModePicker onModeChange={setScanMode} />}

          {loading ? (
            <ScanningButton
              progress={scanProgress}
              phases={isVin ? VIN_PHASES : SCAN_PHASES}
              hint={
                isVin
                  ? "Reading seventeen characters and checking them against the VIN's own checksum"
                  : scanMode === "precise"
                    ? `${SCAN_MODE_META.precise.name} scan — a second look, a magnified detail, and a tiebreak`
                    : "Reading badges, lights and body lines — this takes a few seconds"
              }
            />
          ) : !car ? (
            <GlassButton onClick={run} disabled={!canRun} size="lg" className="w-full py-5">
              {isVin ? "Read VIN" : "Identify car"}
            </GlassButton>
          ) : (
            <div className="flex gap-3">
              <GlassButton onClick={run} className="flex-1">
                {isVin ? "Read again" : "Re-identify"}
              </GlassButton>
              <GlassButton onClick={startNew} className="flex-1">
                New car
              </GlassButton>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-neon-red/50 bg-neon-red/10 p-3 text-sm text-neon-red">
            {error}
          </div>
        )}

        {limitHit && (
          <div className="mt-4 rounded-2xl border border-white/12 bg-card text-card-foreground p-6 text-center">
            <TrafficCone className="mx-auto h-8 w-8 opacity-50" strokeWidth={1.5} aria-hidden />
            <h3 className="display mt-2 text-2xl">Out of free scans</h3>
            <p className="mx-auto mt-1 max-w-sm text-[13px] opacity-70">
              You&apos;ve used all 3 of today&apos;s free scans. Get Carz+ for unlimited scanning.
            </p>
            <GlassButton href="/pricing" className="mt-4">Get Carz+ · $9.99/mo</GlassButton>
            <p className="mt-3 text-xs opacity-60">or $80/year — save 33%</p>
          </div>
        )}

        {/* What the number itself said, above the car it describes. */}
        {vinResult && !limitHit && (
          <VinPanel
            vin={vinResult.vin}
            facts={vinResult.facts}
            corrected={vinResult.corrected}
            ambiguous={vinResult.ambiguous}
            registrySource={vinResult.registrySource}
            surface={vinResult.surface}
          />
        )}

        {/* Result */}
        {car && !limitHit && (
          <section className="mt-6 rounded-3xl border border-black/10 bg-card text-card-foreground p-6">
            {car.isCar ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-2xl font-extrabold">
                    {car.make} {car.model} {car.yearRange}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      car.confidence === "high"
                        ? "bg-neon-green/15 text-neon-green"
                        : car.confidence === "medium"
                          ? "bg-neon-red/15 text-neon-red"
                          : "bg-neon-red/15 text-neon-red",
                    )}
                  >
                    {car.confidence} confidence
                  </span>
                </div>
                {car.notes && <p className="mt-1 text-sm ">{car.notes}</p>}
                {specsPending && (
                  <p className="mt-1.5 flex items-center gap-2 text-xs opacity-60">
                    <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-current" />
                    Loading specs, rarity and values…
                  </p>
                )}
                {car.crossChecked && car.crossCheckNote && (
                  <p className="mt-1.5 text-xs opacity-70">{car.crossCheckNote}</p>
                )}
                {car.visualEvidence?.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs opacity-60 hover:opacity-100">
                      What gave it away
                    </summary>
                    <ul className="mt-1.5 space-y-1">
                      {car.visualEvidence.map((e) => (
                        <li key={e} className="flex items-start gap-2 text-xs opacity-80">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-carz" />
                          <span>{e}</span>
                        </li>
                      ))}
                    </ul>
                    {car.alsoConsidered && (
                      <p className="mt-2 text-xs opacity-60">Ruled out: {car.alsoConsidered}</p>
                    )}
                  </details>
                )}

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Spec k="Body style" v={car.bodyStyle} />
                  <Spec k="Generation" v={car.generation} />
                  <Spec k="Trim (guess)" v={car.trimGuess} />
                  <Spec k="Color" v={car.color} />
                  <Spec k="Engine" v={car.engine} />
                  <Spec k="Drivetrain" v={car.drivetrain} />
                  <Spec k="Horsepower" v={car.horsepower} />
                  <Spec k="0–60 mph" v={car.zeroToSixty} />
                  <Spec k="Top speed" v={car.topSpeed} />
                  <Spec k="Origin" v={car.countryOfOrigin} />
                  <Spec k="Parent company" v={car.parentCompany} />
                  <Spec k="Used price" v={car.priceRangeUsed} />
                </div>

                {car.funFacts.length > 0 && (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
                    {car.funFacts.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}

                {/* Keyed on the identification so a re-scan remounts it and the
                    "saved" state can't carry over onto a different car. */}
                <SaveToGarage
                  key={`${car.make}|${car.model}|${car.yearRange}`}
                  car={car}
                  image={spottedImage}
                />

                <RarityMeter score={car.rarityScore} reason={car.rarityReason} />
                <ValueChart points={car.valueTimeline} />
                <InlineListings make={car.make} model={car.model} goodDealUsd={car.goodDealUsd} />

                <Link
                  href={`/auctions/new?make=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}`}
                  className="mt-3 flex items-center justify-between rounded-2xl border border-black/15 bg-black/[0.05] px-4 py-3 text-sm font-semibold transition hover:border-black/35 hover:bg-black/[0.09]"
                >
                  <span>List this car for auction on Carz</span>
                </Link>

                {(car.valuation || car.reliability || car.collectibility) && (
                  <div className="mt-6 border-t border-black/15 pt-5">
                    {car.valuation && (
                      <>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-neon-green">
                          Valuation
                        </h3>
                        <p className="mb-3 mt-1 text-sm">{car.valuation}</p>
                      </>
                    )}
                    {car.reliability && (
                      <>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-neon-green">
                          Reliability
                        </h3>
                        <p className="mb-3 mt-1 text-sm">{car.reliability}</p>
                      </>
                    )}
                    {car.collectibility && (
                      <>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-neon-green">
                          Collectibility
                        </h3>
                        <p className="mt-1 text-sm">{car.collectibility}</p>
                      </>
                    )}
                  </div>
                )}

                {spottedImage && <CarCustomizer image={spottedImage} car={car} />}
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">
                  {isVin ? "Not a car" : "No car detected"}
                </h2>
                <p className="mt-1 text-sm ">
                  {car.notes ||
                    (isVin
                      ? "That VIN decodes to something that isn't a car."
                      : "Try a clearer photo of the car.")}
                </p>
              </>
            )}
          </section>
        )}

        {/* History (Pro/Max) */}
        {status?.saveHistory && status.history && status.history.length > 0 && (
          <section className="mt-6 rounded-3xl border border-black/10 bg-card text-card-foreground p-6">
            <h3 className="font-bold">Your spotting history</h3>
            <div className="mt-3 space-y-2">
              {status.history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-black/[0.04] px-3 py-2 text-sm"
                >
                  <span className="font-semibold">
                    {h.make} {h.model}{" "}
                    <span className="font-normal ">{h.yearRange}</span>
                  </span>
                  <span className="">{h.date}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Spotting map — free for everyone */}
        <section className="mt-8">
          <h3 className="text-xl font-bold">Where to spot rare cars near you</h3>
          <div className="mt-3">
            <CarHotspotsMap />
          </div>
        </section>
      </main>
    </>
  );
}

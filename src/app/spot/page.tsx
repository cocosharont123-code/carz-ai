"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  Upload,
  Trash2,
  X,
  TrafficCone,
  Check,
  BookmarkPlus,
  ChevronDown,
  ScanLine,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button as GlassButton, StatBox } from "@/components/ui/editorial";
import { ProgressiveFluxLoader } from "@/components/ui/progressive-flux-loader";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { Input } from "@/components/ui/input";
import { useImageUpload } from "@/components/hooks/use-image-upload";
import { CarCustomizer } from "@/components/car-customizer";
import { ScanModePicker } from "@/components/scan-mode-picker";
import { addToGarage } from "@/lib/garage-local";
import { carzPlusMonthly, carzPlusAnnual, carzPlusAnnualSaving } from "@/lib/plans";
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
  apiConfigured?: boolean;
  history?: { make: string; model: string; yearRange: string; date: string }[];
  totalSpots?: number;
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


// Two ways to identify a car: what it looks like, or the number stamped on it.

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
  orbState = "shaping",
}: {
  progress: number;
  phases?: { at: number; label: string }[];
  hint?: string;
  /** Which kind of work is running, so the orb says something rather than
   *  only spinning. */
  orbState?: OrbState;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="w-full rounded-card border border-[var(--line-card)] bg-foreground/[0.02] px-5 py-6"
      // The loader reads its palette from these. It was the brand blue; a
      // loading bar is not where the one allowed colour gets spent.
      style={
        {
          "--flux-from": "#808080",
          "--flux-to": "#ffffff",
        } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-4">
        {/* aria-label is blanked on purpose: the panel around it is already a
            live region announcing the phase, and the orb would otherwise be a
            second thing for a screen reader to read out. */}
        <ThinkingOrb
          state={orbState}
          size={64}
          theme="dark"
          aria-label=""
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <ProgressiveFluxLoader
            value={progress}
            phases={phases}
            className="max-w-none gap-4"
            textClassName="text-xl font-bold text-foreground sm:text-2xl"
            barClassName="h-3 bg-foreground/10"
          />
        </div>
      </div>
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

  // The secondary half of the sticky bar. Same handler, same states; it is a
  // 52px surface pill beside the primary action now rather than a full-width
  // black slab in the middle of the page.
  return (
    <>
      <button
        type="button"
        onClick={save}
        disabled={saved || busy}
        aria-busy={busy || undefined}
        className={cn(
          "press flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full border text-[15px] font-semibold transition",
          saved
            ? "cursor-default border-[var(--line-card)] bg-[var(--color-surface)] text-[var(--color-secondary-text)]"
            : "border-[var(--line-button)] bg-[var(--color-surface)] text-foreground hover:bg-[var(--color-raised)] disabled:opacity-50",
        )}
      >
        {saved ? (
          <>
            <Check className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
            Saved
          </>
        ) : (
          <>
            <BookmarkPlus className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
            {busy ? "Saving…" : "Save"}
          </>
        )}
      </button>
      {/* A full-storage failure has to be said somewhere, and the sticky bar
          has no room for a line of text. Announced to assistive tech and shown
          on the button itself, which stays un-saved so the state is honest. */}
      {error && (
        <p role="alert" className="sr-only">
          {error}
        </p>
      )}
    </>
  );
}

/** A File as a data URL. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
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
    <div className="rounded-xl bg-foreground/[0.04] p-3">
      <div className="text-[12px] uppercase tracking-wide ">{k}</div>
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
      className={`mt-4 rounded-card p-4 ${
        ultra
          ? "bg-gradient-to-r from-neon-red/15 via-neon-green/10 to-neon-blue/15 shadow-[0_0_25px_-8px_rgba(255,255,255,0.7)]"
          : "bg-foreground/[0.04]"
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
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-background/15">
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
  // Was green up, red down. Direction is already carried by the shape of the
  // line and by the figure beside it, so the colour was saying it a third time
  // -- and it was the one thing on this chart a colour-blind reader could not
  // read. Both lines are white.
  const stroke = "#ffffff";
  return (
    <div className="mt-4 rounded-card bg-foreground/[0.04] p-4">
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

/**
 * An id for one identification, shared by the leaderboard entry and the map pin
 * it produces. randomUUID where it exists, which is every browser this app
 * supports; the fallback is for old WebViews and only has to avoid colliding
 * with the handful of scans one device makes.
 */
function newScanId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * One collapsible row of the car detail.
 *
 * `has` rather than checking children for emptiness: a row whose fields are all
 * blank still renders a non-empty children array, so the row would open onto
 * nothing. The caller knows whether it has the data.
 */
function DetailRow({
  label,
  has,
  children,
}: {
  label: string;
  has: boolean;
  children: React.ReactNode;
}) {
  if (!has) return null;
  return (
    <details className="group border-b border-[var(--line-divider)]">
      <summary className="press flex min-h-14 cursor-pointer list-none items-center justify-between py-3 text-[15px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown
          className="h-[18px] w-[18px] shrink-0 text-[var(--color-muted-text)] transition-transform group-open:rotate-180"
          strokeWidth={1.75}
          aria-hidden
        />
      </summary>
      <div className="space-y-3 pb-4">{children}</div>
    </details>
  );
}

/**
 * The four white brackets round the frame. Borders on four small boxes rather
 * than an SVG, so they stay hairline-crisp at any pixel density.
 */
const CORNERS = [
  { key: "tl", cls: "left-4 top-4 border-l-2 border-t-2 rounded-tl-lg border-foreground" },
  { key: "tr", cls: "right-4 top-4 border-r-2 border-t-2 rounded-tr-lg border-foreground" },
  { key: "bl", cls: "bottom-4 left-4 border-b-2 border-l-2 rounded-bl-lg border-foreground" },
  { key: "br", cls: "bottom-4 right-4 border-b-2 border-r-2 rounded-br-lg border-foreground" },
] as const;

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
  // Its own input, separate from the library picker: `capture` is what sends a
  // phone straight to its camera rather than to the photo roll, and the two
  // need different behaviour from the same page.
  const router = useRouter();
  /** The map pin this scan created, when it created one. */
  const [placedSpotId, setPlacedSpotId] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  /**
   * Whether the photo being scanned was taken here and now.
   *
   * Only a live capture goes on the map. A picture chosen from the library
   * could have been taken anywhere by anyone at any time, and a map of those
   * would say nothing. A ref rather than state: it is read once inside an async
   * scan and must not be a render behind.
   */
  const liveCapture = useRef(false);
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

  const canRun = !!previewUrl;
  const run = identify;

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
   * was photographed — specs, rarity, values. A car
   * decode and a photo scan arrive at an identification by completely different
   * routes, but everything after the name is the same work.
   */
  function loadDetails(base: CarReport, rawImage: string, scanId: string) {
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
        // a photo of the car: a leaderboard
        // of door jambs helps nobody.
        if (full.rarityScore > 0 && rawImage) {
          // 1000px. It was 200 at quality 0.5, which was sized for a row
          // thumbnail and nothing else, and looked it the moment the board
          // could be opened. The board stores photos as files now rather than
          // inside its own JSON, so the size costs a fetch rather than being
          // added to a document rewritten on every spot.
          const lbThumb = await downscale(rawImage, 1000, 0.78);
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
              scanId,
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
   * Put a live spot on the map.
   *
   * Runs after the result is on screen, never before it: the scan is what the
   * viewer asked for, and a location prompt in front of the answer would be
   * asking for something in exchange for it. Every failure here is silent —
   * permission refused, no signal, storage down — because none of it is the
   * viewer's problem and the car has already been identified either way.
   *
   * Coordinates are rounded to about 110 metres before they are stored. The
   * blob is public, and a pin should say a GT3 was seen around here rather than
   * publish the doorstep somebody was standing on.
   */
  async function placeOnMap(car: CarReport, scanId: string) {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, // a street is enough; a rooftop is not worth the battery
          timeout: 10_000,
          maximumAge: 60_000,
        });
      });
      const res = await fetch("/api/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          make: car.make,
          model: car.model,
          yearRange: car.yearRange,
          rarityScore: car.rarityScore,
          live: true,
          scanId,
        }),
      });
      // Kept so the detail screen's "View on Map" can open this car's own pin
      // rather than the map in general. Silently ignored if the write did not
      // record one -- coordinates can be unusable, and a dead deep link is
      // worse than no deep link.
      const data = await res.json().catch(() => null);
      if (data?.spot?.id) setPlacedSpotId(data.spot.id as string);
    } catch {
      /* no location, no pin. The scan stands on its own. */
    }
  }

  async function identify() {
    if (!previewUrl) {
      setError("Attach a photo of a car first.");
      return;
    }
    await runIdentify(await objectUrlToDataUrl(previewUrl));
  }

  /**
   * Identify straight from a file.
   *
   * The camera path cannot wait for previewUrl: setting it is a state write and
   * the scan would start a render behind, on whatever the previous photo was.
   * The file it just captured is right here, so it goes in directly.
   */
  async function identifyFile(file: File) {
    await runIdentify(await fileToDataUrl(file));
  }

  async function runIdentify(raw: string) {
    setError("");
    setLimitHit(false);
    setScanProgress(0);
    setLoading(true);
    try {
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
      // One id for this identification, handed to both records it writes. The
      // board and the map are separate stores reached by separate requests, and
      // this is the only moment anything knows the two rows describe one car.
      const scanId = newScanId();
      if (data.car?.isCar) void loadDetails(data.car, raw, scanId);
      if (data.car?.isCar && liveCapture.current) void placeOnMap(data.car, scanId);
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
    setError("");
  }


  return (
    <>
      {/* py-2, not py-14. That 3.5rem at each end was written when the nav was
          at the top and nothing else reserved space: now the back arrow's
          spacer sits above this and the nav's sits below it, so the page was
          padding twice at both ends — which is the room to scroll above the
          heading and below the identify button. */}
      <main className="mx-auto w-full max-w-[480px] px-5 py-2">
        {/* X, wordmark. The app's floating back arrow is suppressed on this
            route so there are not two ways back sitting on top of each other. */}
        <header className="relative flex h-14 items-center">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            aria-label="Close scanner"
            className="press -ml-2 flex h-11 w-11 items-center justify-center rounded-full"
          >
            <X className="h-6 w-6 text-foreground" strokeWidth={1.75} aria-hidden />
          </button>
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-[17px] font-bold lowercase tracking-tight text-foreground">
            carz
          </span>
        </header>
        {/* No "Spot a car" headline. The nav says which page this is, and the
            two buttons under it say what to do — a 7xl restatement of the tab
            you just tapped was taking a third of the screen to add nothing.
            The line under it stays, because it does say something the buttons
            do not. */}
        <p className="mt-3 text-sm ">
          Drop in a photo, then hit identify.
        </p>

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


        {/* The phone's own camera, not one drawn in the page.
            
            An in-page viewfinder — getUserMedia into a <video> — blanked this
            page on a real device, whether it opened on load or on a tap, and
            five attempts at fixing it from here did not shift it. `capture`
            hands the job to the camera app that device already trusts: it
            opens outside the browser, returns a file, and cannot take this
            page down with it, because this page is not running while it is up.
            
            Which is why this screen has no flash button and no flip button.
            The spec asks for both only if a live camera is really used, and
            there is no live camera here to flip or to light — those controls
            would be two switches wired to nothing. */}
        {!previewUrl && !car && (
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={cameraInputRef}
            onChange={(e) => {
              handleFileChange(e);
              const file = e.target.files?.[0];
              if (file) void identifyFile(file);
            }}
          />
        )}

        {/* Upload card */}
        <div className="mt-6 space-y-4">
          <Input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => {
              liveCapture.current = false;
              handleFileChange(e);
            }}
          />

          {/* The photo, once.
              
              Three states, not two. No photo yet: the scanner frame. A photo
              waiting to be identified: the preview, with its replace and remove
              controls. An identified car: nothing here at all, because the
              detail screen below is already showing that same photo full-bleed
              -- rendering both put a cropped half-screen copy directly above
              the full-width one. */}
          {car?.isCar ? null : !previewUrl ? (
            <div
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                // Square and black: this is where the photo will be, framed
                // the way a camera frames it. Drag and drop still lands here,
                // which is the only way to use this screen on a desktop.
                "relative aspect-square w-full overflow-hidden rounded-card bg-background transition-colors",
                isDragging && "bg-[var(--color-surface)]",
              )}
            >
              {/* Four corner brackets. Drawn as borders on four absolutely
                  placed boxes rather than as an SVG, so they stay hairline-
                  crisp at any density. */}
              {CORNERS.map((c) => (
                <span key={c.key} aria-hidden className={cn("pointer-events-none absolute h-8 w-8", c.cls)} />
              ))}
              <p className="absolute inset-x-0 bottom-5 text-center text-[14px] text-[var(--color-secondary-text)]">
                Point your camera at any car
              </p>
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
                <div className="absolute inset-0 bg-background/40 text-foreground opacity-0 transition-opacity group-hover:opacity-100" />
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

          {/* Gallery and shutter. No flip: there is no live camera to flip.
              The shutter opens the same camera input the page already used,
              and the gallery opens the same library picker -- both handlers
              are untouched, only their presentation changed. */}
          {!previewUrl && !car && (
            <div className="flex items-center justify-center gap-10 pt-2">
              <button
                type="button"
                onClick={handleThumbnailClick}
                aria-label="Choose a photo from your library"
                className="press flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10"
              >
                <ImagePlus className="h-5 w-5 text-foreground" strokeWidth={1.75} aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => {
                  liveCapture.current = true;
                  cameraInputRef.current?.click();
                }}
                aria-label="Take a photo"
                className="press flex h-[68px] w-[68px] items-center justify-center rounded-full border-2 border-foreground bg-background shadow-[var(--glow)]"
              >
                <ScanLine className="h-7 w-7 text-foreground" strokeWidth={1.75} aria-hidden />
              </button>

              {/* Balances the row against the gallery button so the shutter is
                  actually centred rather than nearly centred. */}
              <span aria-hidden className="h-12 w-12" />
            </div>
          )}

          {!loading && <ScanModePicker onModeChange={setScanMode} />}

          {loading ? (
            <ScanningButton
              progress={scanProgress}
              phases={SCAN_PHASES}
              // Each pipeline is doing a different kind of work, and the orb
              // has a state for each: Precise takes
              // a second look and adjudicates, Lightning reads the silhouette.
              orbState={scanMode === "precise" ? "solving" : "shaping"}
              hint={
                scanMode === "precise"
                  ? `${SCAN_MODE_META.precise.name} scan — a second look, a magnified detail, and a tiebreak`
                  : "Reading badges, lights and body lines — this takes a few seconds"
              }
            />
          ) : !car ? (
            <GlassButton onClick={run} disabled={!canRun} size="lg" className="w-full py-5">
              Identify car
            </GlassButton>
          ) : (
            <div className="flex gap-3">
              <GlassButton onClick={run} className="flex-1">
                Re-identify
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
          <div className="mt-4 rounded-card border border-[var(--line-card)] bg-[var(--color-surface)] text-foreground p-6 text-center">
            <TrafficCone className="mx-auto h-8 w-8 opacity-50" strokeWidth={1.5} aria-hidden />
            <h3 className="display mt-2 text-2xl">Out of free scans</h3>
            <p className="mx-auto mt-1 max-w-sm text-[15px] opacity-70">
              You&apos;ve used all 3 of today&apos;s free scans. Get Carz+ for unlimited scanning.
            </p>
            <GlassButton href="/pricing" className="mt-4">Get Carz+ · {carzPlusMonthly()}/mo</GlassButton>
            <p className="mt-3 text-xs opacity-60">
              or {carzPlusAnnual()}/year — save {carzPlusAnnualSaving()}%
            </p>
          </div>
        )}

        {/* Car detail.
            
            Make, model and year at three different weights, then the photo,
            then three figures, then everything else behind rows. The whole
            answer used to be one long card: every spec, the rarity meter, the
            value chart and the customizer stacked in a single scroll. The rows
            are collapsed by default, so the screen opens on what the car is
            rather than on everything known about it. */}
        {car && !limitHit && (
          <section className="mt-2">
            {car.isCar ? (
              <>
                <h2 className="text-[20px] font-normal leading-tight text-foreground">{car.make}</h2>
                <p className="text-[34px] font-bold leading-tight tracking-tight text-foreground">
                  {car.model}
                </p>
                {car.yearRange && (
                  <p className="text-[20px] leading-tight text-[var(--color-secondary-text)]">
                    {car.yearRange}
                  </p>
                )}

                {/* Full-bleed and fading to black, the one gradient allowed. */}
                {spottedImage && (
                  <div className="relative -mx-5 mt-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={spottedImage} alt={`${car.make} ${car.model}`} className="w-full" />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background"
                    />
                  </div>
                )}

                {/* Only the figures we actually have. A stat box reading "—" is
                    a box that costs a third of the row to say nothing. */}
                {(car.priceRangeUsed || car.horsepower || car.zeroToSixty) && (
                  <div className="mt-5 grid grid-cols-3 gap-3">
                    {car.priceRangeUsed && <StatBox value={car.priceRangeUsed} label="Retail" />}
                    {car.horsepower && <StatBox value={car.horsepower} label="Horsepower" />}
                    {car.zeroToSixty && <StatBox value={car.zeroToSixty} label="0–60 mph" />}
                  </div>
                )}

                {car.notes && (
                  <>
                    <h3 className="mt-6 text-[20px] font-bold text-foreground">Overview</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-secondary-text)]">
                      {car.notes}
                    </p>
                  </>
                )}

                {specsPending && (
                  <p className="mt-3 text-[14px] text-[var(--color-secondary-text)]">
                    Loading specs, rarity and values…
                  </p>
                )}

                <div className="mt-6">
                  <DetailRow label="Specs" has={!!(car.engine || car.drivetrain || car.bodyStyle)}>
                    <Spec k="Engine" v={car.engine} />
                    <Spec k="Drivetrain" v={car.drivetrain} />
                    <Spec k="Body style" v={car.bodyStyle} />
                    <Spec k="Generation" v={car.generation} />
                    <Spec k="Trim (guess)" v={car.trimGuess} />
                    <Spec k="Colour" v={car.color} />
                    <Spec k="Origin" v={car.countryOfOrigin} />
                    <Spec k="Parent company" v={car.parentCompany} />
                  </DetailRow>

                  <DetailRow
                    label="Performance"
                    has={!!(car.horsepower || car.zeroToSixty || car.topSpeed)}
                  >
                    <Spec k="Horsepower" v={car.horsepower} />
                    <Spec k="0–60 mph" v={car.zeroToSixty} />
                    <Spec k="Top speed" v={car.topSpeed} />
                  </DetailRow>

                  <DetailRow
                    label="Market value"
                    has={!!(car.priceRangeUsed || car.valuation || car.valueTimeline?.length)}
                  >
                    <Spec k="Retail" v={car.priceRangeUsed} />
                    {car.valuation && (
                      <p className="text-[15px] leading-relaxed text-foreground">{car.valuation}</p>
                    )}
                    {car.reliability && (
                      <p className="text-[15px] leading-relaxed text-foreground">{car.reliability}</p>
                    )}
                    {car.collectibility && (
                      <p className="text-[15px] leading-relaxed text-foreground">{car.collectibility}</p>
                    )}
                    <ValueChart points={car.valueTimeline} />
                  </DetailRow>

                  <DetailRow label="Rarity" has={car.rarityScore > 0}>
                    <RarityMeter score={car.rarityScore} reason={car.rarityReason} />
                  </DetailRow>

                  <DetailRow label="Similar models" has={!!car.alsoConsidered}>
                    <p className="text-[15px] leading-relaxed text-foreground">{car.alsoConsidered}</p>
                  </DetailRow>

                  {/* No "Photos & Videos" row. One photo exists -- the one you
                      just took, and it is already at the top of this screen. */}

                  <DetailRow label="Customize this car" has={!!spottedImage}>
                    {spottedImage && <CarCustomizer image={spottedImage} car={car} />}
                  </DetailRow>
                </div>

                {/* Sticky actions. Save keeps its own handler and its own saved
                    state; View on Map goes to this car's pin when the scan
                    dropped one and to the map itself otherwise, which is the
                    difference between a deep link and a dead one. */}
                <div
                  className="fixed inset-x-0 bottom-0 z-[55] mx-auto flex max-w-[480px] gap-3 border-t border-[var(--line-divider)] bg-background px-5 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-3"
                >
                  <SaveToGarage
                    key={`${car.make}|${car.model}|${car.yearRange}`}
                    car={car}
                    image={spottedImage}
                  />
                  <Link
                    href={placedSpotId ? `/map?spot=${encodeURIComponent(placedSpotId)}` : "/map"}
                    className="press flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-carz text-[15px] font-semibold text-carz-ink"
                  >
                    <Navigation className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
                    View on Map
                  </Link>
                </div>
                {/* Clears the sticky bar so the last row is reachable. */}
                <div aria-hidden style={{ height: "calc(env(safe-area-inset-bottom,0px) + 76px)" }} />
              </>
            ) : (
              <>
                <h2 className="text-[20px] font-bold text-foreground">No car detected</h2>
                <p className="mt-1 text-[15px] text-[var(--color-secondary-text)]">
                  {car.notes || "Try a clearer photo of the car."}
                </p>
              </>
            )}
          </section>
        )}

        {/* History (Pro/Max) */}
        {status?.saveHistory && status.history && status.history.length > 0 && (
          <section className="mt-6 rounded-card border border-[var(--line-card)] bg-[var(--color-surface)] text-foreground p-6">
            <h3 className="font-bold">Your spotting history</h3>
            <div className="mt-3 space-y-2">
              {status.history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-foreground/[0.04] px-3 py-2 text-sm"
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

      </main>
    </>
  );
}

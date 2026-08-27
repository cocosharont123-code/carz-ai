"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus, Upload, Trash2, X, TrafficCone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Button as GlassButton } from "@/components/ui/editorial";
import { ProgressiveFluxLoader } from "@/components/ui/progressive-flux-loader";
import { Input } from "@/components/ui/input";
import { useImageUpload } from "@/components/hooks/use-image-upload";
import { CarHotspotsMap } from "@/components/car-hotspots-map";
import { CarCustomizer } from "@/components/car-customizer";
import { addToGarage } from "@/lib/garage-local";
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

// Phase labels tied to what the pipeline is actually doing: a wide look, then
// an independent second opinion, then a magnified read of the deciding detail.
const SCAN_PHASES = [
  { at: 0, label: "reading the photo" },
  { at: 20, label: "matching the shape" },
  { at: 42, label: "reading the badges" },
  { at: 64, label: "cross-checking" },
  { at: 82, label: "almost there" },
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
function ScanningButton({ progress }: { progress: number }) {
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
        phases={SCAN_PHASES}
        className="max-w-none gap-4"
        textClassName="text-xl font-bold text-white sm:text-2xl"
        barClassName="h-3 bg-white/10"
      />
      <p className="mt-4 text-center text-xs opacity-60">
        Reading badges, lights and body lines — this takes a few seconds
      </p>
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

  const {
    previewUrl,
    fileName,
    fileInputRef,
    handleThumbnailClick,
    handleFileChange,
    handleRemove,
  } = useImageUpload();

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
      if (data.car?.isCar) {
        setSpecsPending(true);
        void (async () => {
          try {
            const dres = await fetch("/api/identify/details", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                make: data.car.make,
                model: data.car.model,
                yearRange: data.car.yearRange,
                generation: data.car.generation,
                trimGuess: data.car.trimGuess,
              }),
            });
            const dd = await dres.json();
            if (!dd.specs) return;
            const full = { ...data.car, ...dd.specs };
            setCar(full);
            if (dd.status) setStatus((prev) => ({ ...(prev as Status), ...dd.status }));

            const thumb = await downscale(raw, 360, 0.55);
            addToGarage({
              image: thumb,
              make: full.make,
              model: full.model,
              yearRange: full.yearRange,
              confidence: full.confidence,
              rarityScore: full.rarityScore,
              priceRange: full.priceRangeUsed,
            });
            // Submit to the global rarest-cars leaderboard (best-effort).
            if (full.rarityScore > 0) {
              const lbThumb = await downscale(raw, 200, 0.5);
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
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-14">
        <div className="util-label ">Scan · identify · save</div>
        <h1 className="display mt-3 text-7xl">Spot a car</h1>
        <p className="mt-3 text-sm ">Drop in a photo, then hit identify.</p>

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
                <p className="text-sm font-medium">Click to select a car photo</p>
                <p className="text-xs ">or drag and drop it here</p>
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

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note: 'spotted downtown, looked rare…'"
          />

          {loading ? (
            <ScanningButton progress={scanProgress} />
          ) : !car ? (
            <GlassButton onClick={identify} disabled={!previewUrl} size="lg" className="w-full py-5">
              Identify car
            </GlassButton>
          ) : (
            <div className="flex gap-3">
              <GlassButton onClick={identify} className="flex-1">
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
                <h2 className="text-xl font-bold">No car detected</h2>
                <p className="mt-1 text-sm ">
                  {car.notes || "Try a clearer photo of the car."}
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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, ImagePlus, Upload, Trash2, X, TrafficCone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Button as GlassButton } from "@/components/ui/editorial";
import { Input } from "@/components/ui/input";
import { useImageUpload } from "@/components/hooks/use-image-upload";
import { CarHotspotsMap } from "@/components/car-hotspots-map";
import { CarCustomizer } from "@/components/car-customizer";
import { NearbySpots } from "@/components/nearby-spots";
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
          : "bg-foreground/[0.03]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wide ">Rarity</span>
        <span className="text-sm font-bold">
          {raw}/100 · <span className={ultra ? "text-neon-red" : "text-neon-red"}>{label}</span>
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-background">
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
    <div className="mt-4 rounded-2xl bg-foreground/[0.03] p-4">
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
            <div key={i} className="h-24 animate-pulse rounded-xl bg-foreground/[0.04]" />
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
                className="group flex gap-3 overflow-hidden rounded-xl bg-foreground/[0.03] p-2 ring-1 ring-foreground/[0.06] transition hover:bg-foreground/[0.06]"
              >
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-lg bg-foreground/[0.05]" />
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
                className="rounded-lg bg-foreground/[0.04] px-3 py-1.5 text-sm font-medium hover:bg-foreground/[0.08]"
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

  // The live viewfinder. A photo taken here is the only kind that can reach the
  // "Spotted near you" feed — a camera-roll upload could be any car, taken
  // anywhere, at any time, and the feed's whole claim is "here, now".
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState("");
  const [liveShot, setLiveShot] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Whichever photo is staged, from either source.
  const shotUrl = liveShot || previewUrl;

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  // Release the camera when leaving the page — without this the recording
  // indicator stays lit after navigating away.
  useEffect(() => stopCam, [stopCam]);

  async function startCam() {
    setCamError("");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamOn(true);
    } catch {
      setCamError("Couldn't open the camera. Allow camera access, or upload a photo instead.");
    }
  }

  function captureLive() {
    const v = videoRef.current;
    if (!v || !streamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    // Full sensor resolution here; identify() downscales once, further down, so
    // the badge detail survives to the zoom crop.
    setLiveShot(canvas.toDataURL("image/jpeg", 0.9));
    stopCam();
  }

  // Clear whichever source staged the current photo.
  function clearShot() {
    setLiveShot("");
    handleRemove();
  }

  /**
   * Publish a live spot to the nearby feed. Best-effort by design: it runs after
   * the result is already on screen, and a denied location prompt or a failed
   * request must never surface as a failed scan.
   */
  const publishNearby = useCallback((car: CarReport, source: string) => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const thumb = await downscale(source, 320, 0.5);
          await fetch("/api/nearby", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              live: true,
              make: car.make,
              model: car.model,
              yearRange: car.yearRange,
              rarityScore: car.rarityScore,
              priceRange: car.priceRangeUsed,
              image: thumb,
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            }),
          });
        } catch {
          /* the feed is a nicety; the scan already succeeded */
        }
      },
      () => {
        /* no location, no nearby entry — nothing to tell the user */
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60_000 },
    );
  }, []);

  async function refresh() {
    const s = await fetch("/api/me").then((r) => r.json());
    setStatus(s);
    return s as Status;
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

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
    if (!shotUrl) {
      setError("Take a photo of a car, or attach one, first.");
      return;
    }
    setError("");
    setLimitHit(false);
    setLoading(true);
    try {
      // A live capture is already a data URL; an upload is an object URL.
      const fromCamera = !!liveShot;
      const raw = liveShot || (await objectUrlToDataUrl(shotUrl));
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

      // Only live captures feed "Spotted near you".
      if (fromCamera && data.car?.isCar) publishNearby(data.car, raw);

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

          {camOn && !shotUrl ? (
            <div className="overflow-hidden rounded-2xl border border-white/12 bg-black">
              <div className="relative aspect-[4/3] w-full">
                {/* muted + playsInline so iOS Safari plays inline instead of
                    taking over the screen with its native player. */}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex gap-2 p-3">
                <button
                  onClick={captureLive}
                  className="press flex-1 rounded-xl bg-white py-3 font-black text-[#1f1f1f] transition hover:opacity-90"
                >
                  Take the shot
                </button>
                <button
                  onClick={stopCam}
                  className="press rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : !shotUrl ? (
            <div className="space-y-3">
              {/* Live camera first: it is the only route into "Spotted near you",
                  and on a phone it is also the faster one. */}
              <button
                onClick={startCam}
                className="press flex w-full items-center justify-center gap-2 rounded-2xl border border-carz/50 bg-carz/10 py-4 font-bold transition hover:bg-carz/20"
              >
                <Camera className="h-5 w-5" aria-hidden />
                Open the camera
              </button>
              {camError && <p className="text-sm text-neon-red">{camError}</p>}
              <div
                onClick={handleThumbnailClick}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "flex h-52 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-foreground/15 bg-foreground/[0.02] transition-colors hover:bg-foreground/[0.04]",
                  isDragging && "border-neon-blue/60 bg-neon-blue/5",
                )}
              >
                <div className="rounded-full bg-background p-3 shadow-sm">
                  <ImagePlus className="h-6 w-6 " />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Or select a photo from your library</p>
                  <p className="text-xs ">drag and drop works too</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="group relative h-64 overflow-hidden rounded-xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shotUrl}
                  alt="Car preview"
                  className="h-full w-full object-cover brightness-75 transition-transform duration-300 group-hover:scale-105"
                />
                {liveShot && (
                  <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-white">
                    <Camera className="h-3 w-3" aria-hidden />
                    Live shot
                  </span>
                )}
                <div className="absolute inset-0 bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setLiveShot("");
                      void startCam();
                    }}
                    title="Retake with the camera"
                    className="h-9 w-9 p-0"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleThumbnailClick} title="Choose another photo" className="h-9 w-9 p-0">
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={clearShot} title="Remove" className="h-9 w-9 p-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {(liveShot || fileName) && (
                <div className="mt-2 flex items-center gap-2 text-sm ">
                  <span className="truncate">{liveShot ? "Taken just now on the live camera" : fileName}</span>
                  <button onClick={clearShot} className="ml-auto rounded-full p-1 hover:bg-muted">
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
            /* Scanning takes seconds, so the button becomes the status: full
               width, live spinner, sweeping progress bar. Impossible to miss,
               and it replaces the controls so nothing else can be clicked. */
            <div
              role="status"
              aria-live="polite"
              className="w-full overflow-hidden rounded-2xl border-2 border-neon-blue/70 bg-neon-blue/10 shadow-[0_0_40px_-10px_rgba(0,229,255,0.8)]"
            >
              <div className="flex items-center justify-center gap-3 px-5 py-5">
                <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-white/25 border-t-neon-blue" />
                <span className="text-lg font-black tracking-tight">Reading the car…</span>
              </div>
              <div className="h-1.5 w-full bg-white/10">
                <div className="scan-sweep h-full w-1/3 bg-neon-blue" />
              </div>
            </div>
          ) : !car ? (
            <GlassButton onClick={identify} disabled={!shotUrl} size="lg" className="w-full py-5">
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
          <section className="mt-6 rounded-3xl border border-foreground/[0.05] bg-card text-card-foreground p-6">
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
                  className="mt-3 flex items-center justify-between rounded-2xl border border-foreground/10 bg-foreground/[0.04] px-4 py-3 text-sm font-semibold transition hover:border-foreground/25 hover:bg-foreground/[0.08]"
                >
                  <span>List this car for auction on Carz</span>
                </Link>

                {(car.valuation || car.reliability || car.collectibility) && (
                  <div className="mt-6 border-t border-foreground/10 pt-5">
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
          <section className="mt-6 rounded-3xl border border-foreground/[0.05] bg-card text-card-foreground p-6">
            <h3 className="font-bold">Your spotting history</h3>
            <div className="mt-3 space-y-2">
              {status.history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-foreground/[0.03] px-3 py-2 text-sm"
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

        <NearbySpots />

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

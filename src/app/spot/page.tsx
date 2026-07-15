"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ImagePlus, Upload, Trash2, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useImageUpload } from "@/components/hooks/use-image-upload";
import { CarHotspotsMap } from "@/components/car-hotspots-map";
import { addToGarage } from "@/lib/garage-local";
import { cn } from "@/lib/utils";
import type { CarReport } from "@/lib/identify";

type Status = {
  plan: string;
  planName: string;
  dailyLimit: number | null;
  usedToday: number;
  remainingToday: number | null;
  premiumReport: boolean;
  saveHistory: boolean;
  hotspotsMap: boolean;
  apiConfigured?: boolean;
  history?: { make: string; model: string; yearRange: string; date: string }[];
  totalSpots?: number;
  badges?: { id: string; threshold: number; name: string; emoji: string; blurb: string; earned: boolean }[];
  goals?: { id: string; label: string; done: boolean }[];
};

function DailyGoals({ goals }: { goals?: { id: string; label: string; done: boolean }[] }) {
  if (!goals || goals.length === 0) return null;
  return (
    <div className="mt-6 rounded-3xl border border-foreground/[0.05] bg-card p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">🎯 Today&apos;s goals</h3>
        <span className="text-xs text-muted-foreground">Resets daily</span>
      </div>
      <div className="mt-3 space-y-2">
        {goals.map((g) => (
          <div key={g.id} className="flex items-center gap-2.5 text-sm">
            <span>{g.done ? "✅" : "⚪"}</span>
            <span className={g.done ? "text-emerald-300 line-through" : ""}>{g.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Badges({
  badges,
  total,
}: {
  badges?: { id: string; threshold: number; name: string; emoji: string; earned: boolean }[];
  total?: number;
}) {
  if (!badges || badges.length === 0) return null;
  const t = total ?? 0;
  const next = badges.find((b) => !b.earned);
  return (
    <div className="mt-6 rounded-3xl border border-foreground/[0.05] bg-card p-5 backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">🏅 Badges</h3>
        <span className="text-xs text-muted-foreground">
          {t} car{t === 1 ? "" : "s"} spotted
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {badges.map((b) => (
          <div
            key={b.id}
            className={cn(
              "flex flex-col items-center rounded-2xl p-3 text-center transition",
              b.earned ? "bg-foreground/[0.06] ring-1 ring-amber-400/40" : "bg-foreground/[0.02] opacity-40",
            )}
          >
            <span className="text-2xl">{b.emoji}</span>
            <span className="mt-1 text-[11px] font-semibold leading-tight">{b.name}</span>
            <span className="text-[10px] text-muted-foreground">{b.threshold}+ cars</span>
          </div>
        ))}
      </div>
      {next ? (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Next: {next.name}</span>
            <span>
              {t}/{next.threshold}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
              style={{ width: `${Math.min(100, (t / next.threshold) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-amber-300">🏆 All badges earned — you&apos;re a Legendary Spotter!</p>
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
    <div className="rounded-xl bg-foreground/[0.04] p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
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
          ? "bg-gradient-to-r from-fuchsia-500/15 via-violet-500/10 to-sky-500/15 shadow-[0_0_25px_-8px_rgba(217,70,239,0.7)]"
          : "bg-foreground/[0.03]"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Rarity</span>
        <span className="text-sm font-bold">
          {raw}/100 · <span className={ultra ? "text-fuchsia-300" : "text-amber-400"}>{ultra ? "💎 " : ""}{label}</span>
        </span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-background">
        <div
          className={`h-full rounded-full ${
            ultra
              ? "bg-gradient-to-r from-fuchsia-400 via-violet-400 to-sky-400"
              : "bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
          }`}
          style={{ width: `${bar}%` }}
        />
      </div>
      {reason && <p className="mt-2 text-sm text-muted-foreground">{reason}</p>}
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
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Market value over time
        </span>
        <span className="text-sm font-semibold">
          {fmtUsd(pts[0].usd)} → {fmtUsd(pts[pts.length - 1].usd)}
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
    <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">🏷️ For sale now</span>
        {goodDealUsd > 0 && (
          <span className="text-sm font-semibold">
            Good deal: <span className="text-emerald-400">under {fmtUsd(goodDealUsd)}</span>
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
                      <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                        DEAL
                      </span>
                    )}
                  </div>
                  {it.location && <p className="mt-0.5 text-xs text-muted-foreground">{it.location}</p>}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground">
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
                {s.name} ↗
              </a>
            ))}
          </div>
          {!configured && (
            <p className="mt-2 text-[11px] text-muted-foreground">
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
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
    setLoading(true);
    try {
      const raw = await objectUrlToDataUrl(previewUrl);
      // Smaller upload = faster network + faster model prefill. 1024px is plenty
      // to identify a car and well within Claude's image budget.
      const image = await downscale(raw, 1024, 0.72);
      const res = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Something went wrong.");
        return;
      }
      setCar(data.car);
      setStatus((prev) => ({ ...(prev as Status), ...data.status }));
      // Save this spot to the on-device garage history + global leaderboard.
      if (data.car?.isCar) {
        try {
          const thumb = await downscale(raw, 360, 0.55);
          addToGarage({
            image: thumb,
            make: data.car.make,
            model: data.car.model,
            yearRange: data.car.yearRange,
            confidence: data.car.confidence,
            rarityScore: data.car.rarityScore,
            priceRange: data.car.priceRangeUsed,
          });
          // Submit to the global rarest-cars leaderboard (best-effort).
          if (data.car.rarityScore > 0) {
            const lbThumb = await downscale(raw, 200, 0.5);
            void fetch("/api/leaderboard", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: lbThumb,
                make: data.car.make,
                model: data.car.model,
                yearRange: data.car.yearRange,
                rarityScore: data.car.rarityScore,
                rarityReason: data.car.rarityReason,
                priceRange: data.car.priceRangeUsed,
              }),
            }).catch(() => {});
          }
        } catch {
          /* garage / leaderboard save is best-effort */
        }
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
    setError("");
  }


  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-14">
        <h1 className="text-3xl font-extrabold tracking-tight">Spot a car</h1>
        <p className="mt-1 text-muted-foreground">
          Drop in a photo (and an optional note), then hit identify.
        </p>

        {status && (
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Unlimited</span> identifications ·{" "}
            {status.usedToday} today · free
          </p>
        )}

        {status && status.apiConfigured === false && (
          <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-200">
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
                isDragging && "border-sky-400/60 bg-sky-400/5",
              )}
            >
              <div className="rounded-full bg-background p-3 shadow-sm">
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">Click to select a car photo</p>
                <p className="text-xs text-muted-foreground">or drag and drop it here</p>
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
                <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
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
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
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

          {!car ? (
            <Button onClick={identify} disabled={!previewUrl || loading} className="w-full">
              {loading ? "Reading the car…" : "Identify car"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={identify} disabled={loading} className="flex-1">
                {loading ? "Reading…" : "Re-identify"}
              </Button>
              <Button onClick={startNew} className="flex-1">
                New car
              </Button>
            </div>
          )}
        </div>

        <DailyGoals goals={status?.goals} />
        <Badges badges={status?.badges} total={status?.totalSpots} />

        {loading && (
          <div className="mt-4 flex items-center gap-3 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-sky-400" />
            Reading the car…
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Result */}
        {car && (
          <section className="mt-6 rounded-3xl border border-foreground/[0.05] bg-card p-6 backdrop-blur-xl">
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
                        ? "bg-emerald-500/15 text-emerald-400"
                        : car.confidence === "medium"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-red-500/15 text-red-400",
                    )}
                  >
                    {car.confidence} confidence
                  </span>
                </div>
                {car.notes && <p className="mt-1 text-sm text-muted-foreground">{car.notes}</p>}

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
                  href={`/auctions?make=${encodeURIComponent(car.make)}&model=${encodeURIComponent(car.model)}`}
                  className="mt-3 flex items-center justify-between rounded-2xl border border-foreground/10 bg-foreground/[0.04] px-4 py-3 text-sm font-semibold transition hover:border-foreground/25 hover:bg-foreground/[0.08]"
                >
                  <span>🔨 Find this at auction — bid through Carz</span>
                  <span className="text-muted-foreground">→</span>
                </Link>

                {(car.valuation || car.reliability || car.collectibility) && (
                  <div className="mt-6 border-t border-foreground/10 pt-5">
                    {car.valuation && (
                      <>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-violet-300">
                          💰 Valuation
                        </h3>
                        <p className="mb-3 mt-1 text-sm">{car.valuation}</p>
                      </>
                    )}
                    {car.reliability && (
                      <>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-violet-300">
                          🔧 Reliability
                        </h3>
                        <p className="mb-3 mt-1 text-sm">{car.reliability}</p>
                      </>
                    )}
                    {car.collectibility && (
                      <>
                        <h3 className="text-xs font-bold uppercase tracking-wide text-violet-300">
                          📈 Collectibility
                        </h3>
                        <p className="mt-1 text-sm">{car.collectibility}</p>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold">No car detected 🤔</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {car.notes || "Try a clearer photo of the car."}
                </p>
              </>
            )}
          </section>
        )}

        {/* History (Pro/Max) */}
        {status?.saveHistory && status.history && status.history.length > 0 && (
          <section className="mt-6 rounded-3xl border border-foreground/[0.05] bg-card p-6 backdrop-blur-xl">
            <h3 className="font-bold">Your spotting history</h3>
            <div className="mt-3 space-y-2">
              {status.history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-foreground/[0.03] px-3 py-2 text-sm"
                >
                  <span className="font-semibold">
                    {h.make} {h.model}{" "}
                    <span className="font-normal text-muted-foreground">{h.yearRange}</span>
                  </span>
                  <span className="text-muted-foreground">{h.date}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Hotspots map */}
        <section className="mt-8">
          <h3 className="text-xl font-bold">🗺️ Car hotspots near you</h3>
          <div className="mt-3">
            <CarHotspotsMap />
          </div>
        </section>
      </main>
    </>
  );
}

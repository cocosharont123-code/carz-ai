"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { Avatar } from "@/components/default-avatar";
import { CarPhoto, LiveDot, Skeleton } from "@/components/ui/editorial";

type Spot = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  image?: string;
  rarityScore: number;
  priceRange?: string;
  spotter: string;
  spotterImage?: string;
  ts: number;
  km: number;
};

type State =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string }
  | { kind: "ready"; spots: Spot[]; radiusKm: number };

function ago(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs === 1) return rem ? `1 hr ${rem} min ago` : "1 hr ago";
  return rem ? `${hrs} hrs ${rem} min ago` : `${hrs} hrs ago`;
}

function distance(km: number): string {
  if (km < 1) return "under 1 km away";
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`;
}

export function NearbySpots() {
  const [state, setState] = useState<State>({ kind: "idle" });

  const load = useCallback(async () => {
    if (!("geolocation" in navigator)) {
      setState({ kind: "denied" });
      return;
    }
    setState({ kind: "locating" });

    let pos: GeolocationPosition;
    try {
      pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10_000,
          maximumAge: 5 * 60_000,
        }),
      );
    } catch {
      setState({ kind: "denied" });
      return;
    }

    setState({ kind: "loading" });
    try {
      const { latitude, longitude } = pos.coords;
      const res = await fetch(`/api/nearby?lat=${latitude}&lon=${longitude}`, { cache: "no-store" });
      const d = await res.json();
      if (d.configured === false) {
        setState({ kind: "unconfigured" });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: "Couldn't load nearby spots." });
        return;
      }
      setState({ kind: "ready", spots: Array.isArray(d.spots) ? d.spots : [], radiusKm: d.radiusKm ?? 40 });
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server." });
    }
  }, []);

  // Ask on mount. In browsers that already hold the permission this resolves
  // without a prompt; everywhere else the button below is the way back in.
  // Deferred a tick so the first paint lands before the state starts moving.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) void load();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [load]);

  // Nothing to configure and nothing to show — say nothing rather than render an
  // empty shell on a deployment that has no blob store.
  if (state.kind === "unconfigured") return null;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xl font-bold">Spotted near you</h3>
        <span className="util-label opacity-60">Live camera · last 2 hours</span>
      </div>
      <p className="mt-1 text-[13px] opacity-70">
        Cars other spotters caught on the in-app camera near you. Camera-roll uploads never appear here.
      </p>

      <div className="mt-4">
        {(state.kind === "idle" || state.kind === "locating" || state.kind === "loading") && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        )}

        {state.kind === "denied" && (
          <div className="rounded-2xl border border-white/10 bg-card p-6 text-center text-card-foreground">
            <MapPin className="mx-auto h-7 w-7 opacity-40" strokeWidth={1.5} aria-hidden />
            <p className="mt-2 text-sm font-semibold">Location needed</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] opacity-70">
              This feed is about what is being spotted around you right now, so it needs to know where
              &quot;around you&quot; is. Your location is only used to measure distance — it is never stored.
            </p>
            <button
              onClick={() => void load()}
              className="press mt-4 rounded-full border border-white/20 px-5 py-2 text-sm font-semibold transition hover:border-white/40"
            >
              Use my location
            </button>
          </div>
        )}

        {state.kind === "error" && (
          <div className="rounded-2xl border border-neon-red/40 bg-neon-red/10 p-4 text-sm text-neon-red">
            {state.message}{" "}
            <button onClick={() => void load()} className="underline underline-offset-4">
              Try again
            </button>
          </div>
        )}

        {state.kind === "ready" && state.spots.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-card p-6 text-center text-card-foreground">
            <p className="text-sm font-semibold">Nothing spotted near you yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[13px] opacity-70">
              No one has caught a car on the live camera within {state.radiusKm} km in the last two hours.
              Snap one and you will be the first.
            </p>
          </div>
        )}

        {state.kind === "ready" && state.spots.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {state.spots.map((s) => (
              <article
                key={s.id}
                className="flex gap-3 overflow-hidden rounded-2xl border border-white/10 bg-card p-3 text-card-foreground"
              >
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-foreground/[0.04]">
                  <CarPhoto src={s.image} alt={`${s.make} ${s.model}`} color className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {s.make} {s.model}
                  </p>
                  {s.yearRange && <p className="text-xs opacity-60">{s.yearRange}</p>}
                  <p className="mt-1 flex items-center gap-1.5 text-xs">
                    <LiveDot />
                    <span className="opacity-80">{distance(s.km)}</span>
                    <span className="opacity-40">·</span>
                    <span className="opacity-60">{ago(s.ts)}</span>
                  </p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs opacity-70">
                    <Avatar src={s.spotterImage} size={14} />
                    <span className="truncate">{s.spotter}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

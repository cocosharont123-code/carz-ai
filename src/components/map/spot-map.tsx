"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPinOff, Search } from "lucide-react";
import { claimGpu } from "@/components/camera/camera-in-use";
import { applyMidnight } from "@/components/map/night-style";
import { MapHud } from "@/components/map/map-hud";
import { timeAgo } from "@/lib/time-ago";

type Spot = {
  id: string;
  lat: number;
  lng: number;
  make: string;
  model: string;
  yearRange: string;
  rarityScore: number;
  spotter: string;
  at: number;
  /** The scan that also wrote this car's leaderboard entry, when it earned one. */
  scanId?: string;
};

/**
 * A midnight flight over the city.
 *
 * Satellite imagery dimmed to cosmic navy, roads lit like sodium lamps,
 * elevation under it and stars behind it, on a globe tilted far enough to feel
 * like altitude rather than a plan view.
 *
 * Two things about it are defensive rather than decorative.
 *
 * It claims the GPU while mounted, so the shader behind every page in this app
 * unmounts for as long as the map is up. Two WebGL contexts on one phone is
 * what left /spot blank for days.
 *
 * And the expensive half is a switch, not a given. Satellite tiles, a terrain
 * mesh and a globe together are the heaviest thing here by a distance; a device
 * that cannot hold them starts flat and can be turned up, rather than crashing
 * and offering nothing.
 */
const START = { lng: -80.1918, lat: 25.7617 } as const;
const CINEMATIC_VIEW = { zoom: 12.5, pitch: 62, bearing: -15 } as const;
const FLAT_VIEW = { zoom: 11.5, pitch: 0, bearing: 0 } as const;

/**
 * Whether to open at full quality.
 *
 * Device memory and core count are the only signals a browser offers, and both
 * are absent on Safari — which is most of this app's traffic. An absent signal
 * is treated as capable, because opening flat on a phone that could have done
 * better is a worse first impression than one tap on the switch.
 */
function capableDevice(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 3) return false;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 3) return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return true;
}

export function SpotMap() {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const pins = useRef<mapboxgl.Marker[]>([]);
  /** spot id -> its marker, so ?spot= can open the right one. */
  const byId = useRef<Map<string, mapboxgl.Marker>>(new Map());
  /** The deep link is honoured once, not on every redraw. */
  const flown = useRef(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  /** scanId -> leaderboard entry id, for the pins whose car is on the board. */
  const [board, setBoard] = useState<Map<string, string>>(new Map());

  /**
   * A particular pin, when the leaderboard sent someone to look at it.
   *
   * Read straight off the URL rather than through useSearchParams, so this stays
   * out of a Suspense boundary -- the map is the page, and a boundary around it
   * would mean the whole thing waits.
   */
  const wantedSpot =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("spot");

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [tilted, setTilted] = useState(true);

  useEffect(() => {
    if (!token || !holder.current || map.current) return;
    const release = claimGpu();
    // Decided once, here, and never changed afterwards. Swapping the style at
    // runtime is exactly what blanked this page.
    const wanted: "cinematic" | "flat" = capableDevice() ? "cinematic" : "flat";

    try {
      mapboxgl.accessToken = token;
      const m = new mapboxgl.Map({
        container: holder.current,
        style:
          wanted === "cinematic"
            ? "mapbox://styles/mapbox/satellite-streets-v12"
            : "mapbox://styles/mapbox/dark-v11",
        center: [START.lng, START.lat],
        ...(wanted === "cinematic" ? CINEMATIC_VIEW : FLAT_VIEW),
        projection: { name: "globe" },
        attributionControl: true,
        // High-inertia camera. Low linearity and low deceleration is what makes
        // a drag carry on and ease out rather than stopping under the finger;
        // maxSpeed is the ceiling that keeps a hard flick from flinging the
        // map across the world.
        dragPan: { linearity: 0.25, deceleration: 1800, maxSpeed: 1200 },
        dragRotate: true,
      });

      m.on("style.load", () => {
        if (wanted === "cinematic") applyMidnight(m);
      });
      m.on("error", (e) => console.error("map error:", e?.error ?? e));

      map.current = m;
      // Deferred: a synchronous write here cascades renders, and the frame it
      // costs is one nobody sees.
      void Promise.resolve().then(() => setTilted(wanted === "cinematic"));
    } catch (e) {
      console.error("map failed to start:", e);
      void Promise.resolve().then(() => setFailed(true));
    }

    return () => {
      map.current?.remove();
      map.current = null;
      release();
    };
  }, [token]);

  /**
   * Pins, refreshed when the tab comes back.
   *
   * They expire after a day, and the filtering happens server-side — so a map
   * left open overnight would keep showing pins that no longer exist until
   * something asked again. Coming back to the tab is that something. No polling:
   * a map nobody is looking at does not need to be right.
   */
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/spots", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setSpots(Array.isArray(d.spots) ? d.spots : []);
        })
        .catch(() => {});
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  /**
   * Which scans made the leaderboard, so a pin can offer its entry.
   *
   * Fetched once and separately from the spots: a pin is useful whether or not
   * this arrives, so the two are not made to wait for each other. Failing leaves
   * the map exactly as it was before the link existed.
   */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const cars: { id: string; scanId?: string }[] = Array.isArray(d.cars) ? d.cars : [];
        const map = new Map<string, string>();
        for (const c of cars) if (c.scanId) map.set(c.scanId, c.id);
        setBoard(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Draw a pin per spot.
   *
   * Markers rather than a GeoJSON layer: there are at most a few hundred, each
   * wants a popup, and a symbol layer would mean shipping an icon atlas and
   * hand-writing the hit testing for what the marker API already does.
   *
   * Waits for the style if it is not ready: markers added before the first
   * style load are dropped on the floor. The style never changes after startup
   * any more, so this runs once per set of spots and no more.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || spots.length === 0) return;

    const draw = () => {
      pins.current.forEach((p) => p.remove());
      pins.current = spots.map((s) => {
        // Kept so a deep link can find this pin again by its spot id.
        const el = document.createElement("div");
        // Rare cars burn brighter. It was amber against cyan; it is a solid
        // white dot against a hollow one, so rarity still reads at a glance
        // without a hue doing the work.
        const rare = s.rarityScore >= 70;
        el.style.cssText = [
          "width:14px;height:14px;border-radius:9999px;cursor:pointer",
          `background:${rare ? "#ffffff" : "#000000"}`,
          "border:2px solid #ffffff",
          rare ? "box-shadow:0 0 12px rgba(255,255,255,0.9)" : "",
        ].join(";");

        const name = `${s.make} ${s.model}`.trim();
        // Only when this car actually has an entry. A link that leads to a board
        // the car is not on is worse than no link, and the board keeps just the
        // highest scorer per model, so plenty of pins have none.
        const entryId = s.scanId ? board.get(s.scanId) : undefined;
        const rarity = Math.round(s.rarityScore);
        return new mapboxgl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(
              `<div style="font:600 13px/1.4 -apple-system,system-ui,sans-serif;color:#fff">
                 ${escapeHtml(name)}
                 <div style="font-weight:400;opacity:.65;margin-top:2px">
                   ${escapeHtml(s.spotter)} · ${escapeHtml(timeAgo(s.at))}${
                     rarity > 0 ? ` · rarity ${rarity}` : ""
                   }
                 </div>
                 ${
                   entryId
                     ? `<a href="/leaderboard?car=${encodeURIComponent(entryId)}"
                          style="display:flex;align-items:center;min-height:44px;margin-top:6px;
                                 color:#ffffff;font-weight:600;text-decoration:underline">
                          See it on the leaderboard &rsaquo;
                        </a>`
                     : ""
                 }
               </div>`,
            ),
          )
          .addTo(m);
      });
      byId.current = new Map(spots.map((s, i) => [s.id, pins.current[i]]));
    };

    if (m.isStyleLoaded()) draw();
    m.on("style.load", draw);
    return () => {
      m.off("style.load", draw);
      pins.current.forEach((p) => p.remove());
      pins.current = [];
    };
  }, [spots, board]);

  /**
   * Fly to the pin someone was sent to see.
   *
   * Waits for the pins rather than running on mount: the spot list arrives after
   * the map does, and there is nothing to fly to until it has. Once only -- the
   * pins are redrawn whenever the board arrives, and re-flying then would yank
   * the view back out from under someone who had already moved on.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !wantedSpot || flown.current) return;
    const target = spots.find((s) => s.id === wantedSpot);
    if (!target) return;
    flown.current = true;
    m.flyTo({ center: [target.lng, target.lat], zoom: 15.5, duration: 2200, essential: true });
    // Opened after the flight rather than during it, so the popup is not left
    // hanging over the map while the camera is still moving.
    m.once("moveend", () => byId.current.get(wantedSpot)?.togglePopup());
  }, [spots, wantedSpot]);

  const toggleTilt = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const next = !tilted;
    setTilted(next);
    m.easeTo({ pitch: next ? 62 : 0, bearing: next ? -15 : 0, duration: 800 });
  }, [tilted]);

  const locate = useCallback(() => {
    const m = map.current;
    if (!m || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const at: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        m.flyTo({ center: at, zoom: 14, essential: true, duration: 2000 });
        marker.current?.remove();
        // The viewer's own position: a white dot, per the spec. Mapbox's default
        // marker is a teardrop pin, which is the shape used for cars -- a plain
        // circle keeps "where I am" distinct from "where a car was".
        const dot = document.createElement("div");
        dot.style.cssText = [
          "width:16px;height:16px;border-radius:9999px",
          "background:#ffffff",
          "box-shadow:0 0 0 4px rgba(255,255,255,0.25), 0 0 18px rgba(255,255,255,0.65)",
        ].join(";");
        marker.current = new mapboxgl.Marker({ element: dot }).setLngLat(at).addTo(m);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  if (!token || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6">
        <div className="glass-card w-full max-w-sm rounded-3xl p-6 text-center">
          <MapPinOff className="mx-auto h-7 w-7 opacity-50" strokeWidth={1.5} aria-hidden />
          <h2 className="display mt-3 text-2xl">Map is off</h2>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed opacity-70">
            {!token
              ? "NEXT_PUBLIC_MAPBOX_TOKEN isn't set on this deployment, so there is no map to draw."
              : "The map couldn't start on this device."}
          </p>
        </div>
      </div>
    );
  }

  // Filters the pins as you type. Matched against make, model and the spotter,
  // so typing a handle finds what that person found.
  const shown = query.trim()
    ? spots.filter((sp) =>
        `${sp.make} ${sp.model} ${sp.spotter}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : spots;

  return (
    <div className="relative h-full w-full bg-black">
      <div ref={holder} className="h-full w-full" />

      {/* Floating search. No filter button beside it: the spec asks for one
          only if we have filters, and a spot carries a car, a spotter and a
          time -- there is nothing here to filter by that this field does not
          already match on. */}
      <div
        className="absolute inset-x-3 z-10"
        style={{ top: "calc(var(--safe-top) + 0.75rem)" }}
      >
        <div className="relative mr-14">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-muted-text)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cars, events, or places"
            aria-label="Search the map"
            className="h-[52px] w-full rounded-full border border-[var(--line-card)] bg-[var(--color-surface)] pl-11 pr-4 text-[15px] text-white outline-none placeholder:text-[var(--color-muted-text)] [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
      </div>

      <MapHud
        tilted={tilted}
        onTilt={toggleTilt}
        onLocate={locate}
        locating={locating}
      />

      {/* Cars Near You. A sheet rather than a line of text: it is the only way
          to see what is on the map without hunting for pins, and on a phone
          most of the pins are off screen. */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 rounded-t-sheet border-t border-[var(--line-card)] bg-black/95 px-5 pb-4 pt-2"
        style={{ paddingBottom: "1rem" }}
      >
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-white/25" />
        <h2 className="mt-3 text-[17px] font-semibold text-white">Cars Near You</h2>

        {shown.length === 0 ? (
          <p className="mt-2 pb-1 text-[14px] text-[var(--color-secondary-text)]">
            {spots.length === 0
              ? "Cars appear here when they are scanned live in the app."
              : "Nothing matches that."}
          </p>
        ) : (
          // Horizontal, so the sheet stays short enough to leave most of the
          // map visible.
          <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
            {shown.slice(0, 12).map((sp) => (
              <button
                key={sp.id}
                type="button"
                onClick={() => {
                  const m = map.current;
                  if (!m) return;
                  m.flyTo({ center: [sp.lng, sp.lat], zoom: 15.5, duration: 1400, essential: true });
                  m.once("moveend", () => byId.current.get(sp.id)?.togglePopup());
                }}
                className="press w-36 shrink-0 text-left"
              >
                <span className="block truncate text-[15px] font-semibold text-white">
                  {`${sp.make} ${sp.model}`.trim()}
                </span>
                {/* No distance: a spot is rounded to about 110 metres and the
                    viewer's position is only known if they asked to be found,
                    so a figure here would be invented most of the time. */}
                <span className="block truncate text-[14px] text-[var(--color-secondary-text)]">
                  {sp.spotter} · {timeAgo(sp.at)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Popups take HTML, and a car name is user-supplied text. */
function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

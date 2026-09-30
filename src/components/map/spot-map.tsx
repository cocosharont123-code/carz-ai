"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPinOff } from "lucide-react";
import { claimGpu } from "@/components/camera/camera-in-use";
import { applyMidnight } from "@/components/map/night-style";
import { MapHud, type MapQuality } from "@/components/map/map-hud";
import { timeAgo } from "@/components/feed/post-card";

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
  const [spots, setSpots] = useState<Spot[]>([]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [quality, setQuality] = useState<MapQuality>("cinematic");
  const [tilted, setTilted] = useState(true);

  useEffect(() => {
    if (!token || !holder.current || map.current) return;
    const release = claimGpu();
    const wanted: MapQuality = capableDevice() ? "cinematic" : "flat";

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
      void Promise.resolve().then(() => {
        setQuality(wanted);
        setTilted(wanted === "cinematic");
      });
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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/spots", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSpots(Array.isArray(d.spots) ? d.spots : []);
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
   * Re-run when the style changes as well as when the spots do — setStyle tears
   * down everything the map is holding, markers included.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || spots.length === 0) return;

    const draw = () => {
      pins.current.forEach((p) => p.remove());
      pins.current = spots.map((s) => {
        const el = document.createElement("div");
        // Rare cars burn brighter. Everything else is the app's cyan.
        const rare = s.rarityScore >= 70;
        el.style.cssText = [
          "width:14px;height:14px;border-radius:9999px;cursor:pointer",
          `background:${rare ? "#ffad42" : "#00e5ff"}`,
          "border:2px solid rgba(255,255,255,0.85)",
          `box-shadow:0 0 12px ${rare ? "rgba(255,173,66,0.9)" : "rgba(0,229,255,0.9)"}`,
        ].join(";");

        const name = `${s.make} ${s.model}`.trim();
        return new mapboxgl.Marker({ element: el })
          .setLngLat([s.lng, s.lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 16, closeButton: false }).setHTML(
              `<div style="font:600 13px/1.4 -apple-system,system-ui,sans-serif;color:#fff">
                 ${escapeHtml(name)}
                 <div style="font-weight:400;opacity:.65;margin-top:2px">
                   ${escapeHtml(s.spotter)} · ${escapeHtml(timeAgo(s.at))}
                 </div>
               </div>`,
            ),
          )
          .addTo(m);
      });
    };

    if (m.isStyleLoaded()) draw();
    m.on("style.load", draw);
    return () => {
      m.off("style.load", draw);
      pins.current.forEach((p) => p.remove());
      pins.current = [];
    };
  }, [spots, quality]);

  /** Swap the whole style. The night treatment is re-applied once it loads. */
  const changeQuality = useCallback((next: MapQuality) => {
    const m = map.current;
    if (!m) return;
    setQuality(next);
    m.once("style.load", () => {
      if (next === "cinematic") applyMidnight(m);
      else m.setTerrain(null);
    });
    m.setStyle(
      next === "cinematic"
        ? "mapbox://styles/mapbox/satellite-streets-v12"
        : "mapbox://styles/mapbox/dark-v11",
    );
    const view = next === "cinematic" ? CINEMATIC_VIEW : FLAT_VIEW;
    m.easeTo({ pitch: view.pitch, bearing: view.bearing, zoom: view.zoom, duration: 900 });
    setTilted(next === "cinematic");
  }, []);

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
        marker.current = new mapboxgl.Marker({ color: "#00e5ff" }).setLngLat(at).addTo(m);
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

  return (
    <div className="relative h-full w-full bg-[#04040d]">
      <div ref={holder} className="h-full w-full" />
      <MapHud
        quality={quality}
        onQuality={changeQuality}
        tilted={tilted}
        onTilt={toggleTilt}
        onLocate={locate}
        locating={locating}
        spotCount={spots.length}
      />
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

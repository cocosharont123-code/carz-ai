"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Crosshair, MapPinOff } from "lucide-react";
import { claimGpu } from "@/components/camera/camera-in-use";

/**
 * The map.
 *
 * Mapbox GL holds a WebGL context, and so does the shader behind every page in
 * this app. Two of those at once is what left /spot blank on a real phone for
 * days, so the map claims the GPU on mount and the shader unmounts for as long
 * as it is up. Same mechanism, same reason.
 *
 * Miami by default, because that is where the hunt is and a map that opens on
 * the middle of the Atlantic tells nobody anything. Geolocation moves it, if
 * it is offered and allowed — never asked for on load, because a permission
 * prompt the moment a page opens is the thing everyone dismisses.
 */
const FALLBACK = { lng: -80.1918, lat: 25.7617, zoom: 11 } as const;

export function SpotMap() {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  // Read at module scope, not in the effect: whether a token exists is known
  // before anything renders, so it is a fact about the build rather than state
  // to be discovered — and writing it from an effect is a cascading render.
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [failed, setFailed] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!token || !holder.current || map.current) return;

    // Held for as long as the map is mounted, not just while it draws.
    const release = claimGpu();

    try {
      mapboxgl.accessToken = token;
      const m = new mapboxgl.Map({
        container: holder.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [FALLBACK.lng, FALLBACK.lat],
        zoom: FALLBACK.zoom,
        attributionControl: true,
      });
      m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      m.on("error", (e) => {
        // A bad or restricted token fails here rather than at construction.
        console.error("map error:", e?.error ?? e);
      });
      map.current = m;
    } catch (e) {
      console.error("map failed to start:", e);
      // Deferred a microtask rather than written in the effect body: a
      // synchronous write here cascades renders, which this project lints
      // against. The frame it costs is one nobody sees.
      void Promise.resolve().then(() => setFailed("broken"));
    }

    return () => {
      map.current?.remove();
      map.current = null;
      release();
    };
  }, [token]);

  function locate() {
    if (!map.current || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        map.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 13,
          essential: true,
        });
        new mapboxgl.Marker({ color: "#00e5ff" })
          .setLngLat([pos.coords.longitude, pos.coords.latitude])
          .addTo(map.current!);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const problem = !token ? "no-token" : failed;

  if (problem) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6">
        <div className="glass-card w-full max-w-sm rounded-3xl p-6 text-center">
          <MapPinOff className="mx-auto h-7 w-7 opacity-50" strokeWidth={1.5} aria-hidden />
          <h2 className="display mt-3 text-2xl">Map is off</h2>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed opacity-70">
            {problem === "no-token"
              ? "NEXT_PUBLIC_MAPBOX_TOKEN isn't set on this deployment, so there is no map to draw."
              : "The map couldn't start on this device."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={holder} className="h-full w-full" />

      <button
        type="button"
        onClick={locate}
        disabled={locating}
        aria-label="Centre on my location"
        style={{ bottom: "calc(var(--nav-h) + 0.5rem)" }}
        className="press glass-bubble absolute left-3 z-10 flex min-h-11 items-center gap-2 rounded-full px-4 text-[13px] font-bold disabled:opacity-50"
      >
        <Crosshair className="h-4 w-4" strokeWidth={2} aria-hidden />
        {locating ? "Finding you…" : "My location"}
      </button>
    </div>
  );
}

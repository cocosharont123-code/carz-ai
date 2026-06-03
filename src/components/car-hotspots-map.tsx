"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState } from "react";

type CatKey = "luxury" | "dealer" | "shop" | "wash" | "track";
const CATS: Record<CatKey, { color: string; label: string }> = {
  luxury: { color: "#fbbf24", label: "Luxury dealer" },
  dealer: { color: "#38bdf8", label: "Car dealer" },
  shop: { color: "#a78bfa", label: "Tuner / auto shop" },
  wash: { color: "#34d399", label: "Detailing / car wash" },
  track: { color: "#fb7185", label: "Race track" },
};

const LUX_RE =
  /porsche|ferrari|lamborghini|maserati|bentley|rolls.?royce|aston.?martin|mclaren|bugatti|lotus|koenigsegg|bmw|mercedes|audi|jaguar|land.?rover|range.?rover|tesla|lexus|alfa.?romeo|cadillac|genesis|acura|infiniti|polestar|lucid/i;

function catKeyFor(tags: Record<string, string>): CatKey | null {
  if (tags.leisure === "track") return "track";
  if (tags.amenity === "car_wash") return "wash";
  if (tags.shop === "car_repair") return "shop";
  if (tags.shop === "car") return LUX_RE.test(tags.name || "") ? "luxury" : "dealer";
  return null;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function fetchOverpass(query: string): Promise<{ elements?: any[] } | null> {
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const resp = await fetch(url, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) continue;
      return await resp.json();
    } catch {
      // try the next mirror
    }
  }
  return null;
}

// Load Leaflet from CDN once (avoids all bundler/worker pitfalls).
function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.L) return resolve(w.L);
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(w.L));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "leaflet-js";
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve(w.L);
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

export function CarHotspotsMap() {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const located = useRef(false);
  const [statusText, setStatusText] = useState("Loading map…");

  async function findSpots(lat: number, lon: number) {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !layerRef.current) return;
    setStatusText("Finding luxury dealers & car spots near you…");
    const R = 12000;
    const filters = [
      'node["shop"="car"]',
      'way["shop"="car"]',
      'node["shop"="car_repair"]',
      'way["shop"="car_repair"]',
      'node["amenity"="car_wash"]',
      'way["amenity"="car_wash"]',
      'node["leisure"="track"]["sport"~"motor"]',
      'way["leisure"="track"]["sport"~"motor"]',
    ]
      .map((f) => `${f}(around:${R},${lat},${lon});`)
      .join("");
    const query = `[out:json][timeout:25];(${filters});out center 200;`;

    const data = await fetchOverpass(query);
    layerRef.current.clearLayers();
    L.circleMarker([lat, lon], {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: "#ff5c5c",
      fillOpacity: 1,
    })
      .addTo(layerRef.current)
      .bindPopup("You");

    if (!data) {
      setStatusText("All map servers are busy right now — tap 📍 to retry.");
      return;
    }

    let count = 0;
    let lux = 0;
    const seen = new Set<string>();
    for (const el of data.elements ?? []) {
      const plat = el.lat ?? el.center?.lat;
      const plon = el.lon ?? el.center?.lon;
      if (typeof plat !== "number" || typeof plon !== "number") continue;
      const tags = (el.tags ?? {}) as Record<string, string>;
      const key = catKeyFor(tags);
      if (!key) continue;
      const id = `${el.type}/${el.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const cat = CATS[key];
      const name = (tags.name || cat.label).replace(/</g, "&lt;");
      L.circleMarker([plat, plon], {
        radius: 7,
        color: "#000000",
        weight: 1.5,
        fillColor: cat.color,
        fillOpacity: 0.95,
      })
        .addTo(layerRef.current)
        .bindPopup(`<b>${name}</b><br>${cat.label}`);
      count++;
      if (key === "luxury") lux++;
    }
    setStatusText(
      count
        ? `Found ${count} spots nearby${lux ? ` · ${lux} luxury dealer${lux > 1 ? "s" : ""}` : ""}.`
        : "Nothing found here — pan to a city and tap 📍.",
    );
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setStatusText("Location unavailable on this device.");
      return;
    }
    setStatusText("Locating you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.setView([latitude, longitude], 12);
        findSpots(latitude, longitude);
      },
      () => setStatusText("Allow location (or pan the map) and tap 📍."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !divRef.current || mapRef.current) return;
        LRef.current = L;
        const map = L.map(divRef.current).setView([39.5, -98.35], 4);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
          subdomains: "abcd",
          maxZoom: 19,
          attribution: "© OpenStreetMap · © CARTO",
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setTimeout(() => map.invalidateSize(), 200);
        setStatusText("Tap 📍 (or allow location) to find car spots near you.");
        if (!located.current && "geolocation" in navigator) {
          located.current = true;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              const { latitude, longitude } = pos.coords;
              map.setView([latitude, longitude], 12);
              findSpots(latitude, longitude);
            },
            () => {
              if (!cancelled) setStatusText("Allow location (or pan the map) and tap 📍 to find spots.");
            },
            { enableHighAccuracy: true, timeout: 10000 },
          );
        }
      } catch {
        setStatusText("Couldn't load the map. Check your connection and refresh.");
      }
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div>
      <div
        ref={divRef}
        className="h-[420px] w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-background"
      />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {Object.values(CATS).map((c) => (
          <span key={c.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.label}
          </span>
        ))}
      </div>
      <div className="mt-3">
        <button
          onClick={locate}
          className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-medium hover:bg-white/[0.12]"
        >
          📍 Find spots near me
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{statusText}</p>
    </div>
  );
}

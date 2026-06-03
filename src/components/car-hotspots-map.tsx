"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import { Map, MapMarker, MarkerContent, MarkerLabel, MarkerTooltip } from "@/components/ui/mapcn-marker-label";

type Spot = {
  id: string;
  name: string;
  category: string;
  color: string;
  luxury: boolean;
  lng: number;
  lat: number;
};

const CATS = {
  luxury: { color: "#fbbf24", label: "Luxury dealer" },
  dealer: { color: "#38bdf8", label: "Car dealer" },
  shop: { color: "#a78bfa", label: "Tuner / auto shop" },
  wash: { color: "#34d399", label: "Detailing / car wash" },
  track: { color: "#fb7185", label: "Race track" },
};

const LUX_RE =
  /porsche|ferrari|lamborghini|maserati|bentley|rolls.?royce|aston.?martin|mclaren|bugatti|lotus|koenigsegg|bmw|mercedes|audi|jaguar|land.?rover|range.?rover|tesla|lexus|alfa.?romeo|cadillac|genesis|acura|infiniti|polestar|lucid/i;

function catKeyFor(tags: Record<string, string>): keyof typeof CATS | null {
  if (tags.leisure === "track") return "track";
  if (tags.amenity === "car_wash") return "wash";
  if (tags.shop === "car_repair") return "shop";
  if (tags.shop === "car") return LUX_RE.test(tags.name || "") ? "luxury" : "dealer";
  return null;
}

type OverpassEl = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function fetchOverpass(query: string): Promise<{ elements?: OverpassEl[] } | null> {
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const resp = await fetch(url, { method: "POST", body: "data=" + encodeURIComponent(query), signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) continue;
      return await resp.json();
    } catch {
      // try the next mirror
    }
  }
  return null;
}

export function CarHotspotsMap() {
  const mapRef = useRef<MlMap | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [statusText, setStatusText] = useState("Finding luxury dealers & car spots near you…");
  const located = useRef(false);

  async function findSpots(lat: number, lon: number) {
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
    if (!data) {
      setStatusText("All map servers are busy right now — tap 📍 to retry.");
      return;
    }
    const found: Spot[] = [];
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
      found.push({
        id,
        name: tags.name || cat.label,
        category: cat.label,
        color: cat.color,
        luxury: key === "luxury",
        lng: plon,
        lat: plat,
      });
    }
    // luxury dealers first, cap to keep the map readable
    found.sort((a, b) => Number(b.luxury) - Number(a.luxury));
    const limited = found.slice(0, 80);
    setSpots(limited);
    const lux = found.filter((s) => s.luxury).length;
    setStatusText(
      found.length
        ? `Found ${found.length} spots nearby${lux ? ` · ${lux} luxury dealer${lux > 1 ? "s" : ""}` : ""}.`
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
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 11, duration: 1200 });
        findSpots(latitude, longitude);
      },
      () => setStatusText("Allow location (or pan the map) and tap 📍."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  useEffect(() => {
    if (located.current) return;
    located.current = true;
    if (!("geolocation" in navigator)) {
      setStatusText("Pan the map and tap 📍 to find car spots.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 11, duration: 1200 });
        findSpots(latitude, longitude);
      },
      () => setStatusText("Allow location (or pan the map) and tap 📍 to find spots."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  return (
    <div>
      <div className="h-[440px] w-full overflow-hidden rounded-2xl border border-white/[0.06]">
        <Map ref={mapRef} center={[-98, 39]} zoom={3.4}>
          {spots.map((s) => (
            <MapMarker key={s.id} longitude={s.lng} latitude={s.lat}>
              <MarkerContent>
                <div
                  className="size-3.5 rounded-full border-2 border-black shadow-lg transition-transform hover:scale-150"
                  style={{ background: s.color }}
                />
                {s.luxury && (
                  <MarkerLabel position="bottom" className="rounded bg-black/70 px-1 text-amber-300">
                    {s.name}
                  </MarkerLabel>
                )}
              </MarkerContent>
              <MarkerTooltip>
                {s.name} · {s.category}
              </MarkerTooltip>
            </MapMarker>
          ))}
        </Map>
      </div>

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

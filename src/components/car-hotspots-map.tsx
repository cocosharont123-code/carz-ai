"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MlMap } from "maplibre-gl";
import { Map, MapMarker, MarkerContent, MarkerLabel, MarkerTooltip } from "@/components/ui/mapcn-marker-label";

type Spot = {
  id: string;
  name: string;
  category: string;
  color: string;
  rank: number;
  top: boolean; // worth a label on the map
  lng: number;
  lat: number;
};

// Places rare cars actually turn up — not the nearest Toyota lot or car wash.
// `rank` orders the pins so the best spots survive the 80-pin cap.
const CATS = {
  track: { color: "#ff3131", label: "Race track", rank: 0, top: true },
  museum: { color: "#ffd400", label: "Car museum", rank: 1, top: true },
  showroom: { color: "#ff007f", label: "Supercar showroom", rank: 2, top: true },
  marina: { color: "#00e5ff", label: "Marina", rank: 3, top: false },
  casino: { color: "#c77dff", label: "Casino", rank: 4, top: false },
  hotel: { color: "#39ff14", label: "5-star hotel", rank: 5, top: false },
  golf: { color: "#ffffff", label: "Golf & country club", rank: 6, top: false },
};

// Deliberately narrow: marques you stop and look at. Mass-premium badges
// (BMW/Mercedes/Audi/Lexus/Tesla) are on every high street and just add noise.
const EXOTIC_RE =
  /porsche|ferrari|lamborghini|maserati|bentley|rolls.?royce|aston.?martin|mclaren|bugatti|koenigsegg|pagani|lotus|alfa.?romeo|jaguar|land.?rover|range.?rover|polestar|lucid|rimac|exotic|supercar|prestige/i;

const CAR_MUSEUM_RE = /auto|car|motor|vehicle|transport/i;

function catKeyFor(tags: Record<string, string>): keyof typeof CATS | null {
  if (tags.highway === "raceway") return "track";
  if (tags.leisure === "track") return /motor|racing|karting/i.test(tags.sport || "") ? "track" : null;
  // Plenty of car museums are tagged only `tourism=museum`, so fall back to the name.
  if (tags.tourism === "museum")
    return tags.museum === "transport" || CAR_MUSEUM_RE.test(tags.name || "") ? "museum" : null;
  if (tags.shop === "car") return EXOTIC_RE.test(tags.name || "") ? "showroom" : null;
  if (tags.tourism === "hotel") return /^[45]/.test(tags.stars || "") ? "hotel" : null;
  if (tags.amenity === "casino") return "casino";
  if (tags.leisure === "marina") return "marina";
  if (tags.leisure === "golf_course") return "golf";
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

// Default view if geolocation is denied — somewhere full of cars so pins always show.
const DEFAULT_CENTER: [number, number] = [-118.2437, 34.0522]; // Los Angeles

export function CarHotspotsMap() {
  const mapRef = useRef<MlMap | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [statusText, setStatusText] = useState("Loading map…");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef<{ lat: number; lon: number } | null>(null);
  const started = useRef(false);

  const findSpots = useCallback(async (lat: number, lon: number) => {
    const last = lastFetchRef.current;
    // skip if we already loaded this area (~2.5 km)
    if (last && Math.abs(last.lat - lat) < 0.025 && Math.abs(last.lon - lon) < 0.025) return;
    lastFetchRef.current = { lat, lon };
    setStatusText("Finding rare-car spots in this area…");

    const R = 12000;
    // Tag-only filters. Name/sport/stars matching happens in `catKeyFor` below:
    // a `~"…",i` regex in the query can't use Overpass's index and times out.
    const filters = [
      // Motorsport
      'node["leisure"="track"]["sport"]',
      'way["leisure"="track"]["sport"]',
      'way["highway"="raceway"]',
      // Museums (narrowed to car museums client-side)
      'node["tourism"="museum"]',
      'way["tourism"="museum"]',
      // Dealers (narrowed to exotic marques client-side)
      'node["shop"="car"]',
      'way["shop"="car"]',
      // Where the money parks
      'node["tourism"="hotel"]["stars"]',
      'way["tourism"="hotel"]["stars"]',
      'node["amenity"="casino"]',
      'way["amenity"="casino"]',
      'node["leisure"="marina"]',
      'way["leisure"="marina"]',
      'way["leisure"="golf_course"]',
    ]
      .map((f) => `${f}(around:${R},${lat},${lon});`)
      .join("");
    const query = `[out:json][timeout:25];(${filters});out center 600;`;

    const data = await fetchOverpass(query);
    if (!data) {
      lastFetchRef.current = null; // allow a retry of the same area
      setStatusText("Map servers are busy — pan the map a little to retry.");
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
        rank: cat.rank,
        top: cat.top,
        lng: plon,
        lat: plat,
      });
    }
    found.sort((a, b) => a.rank - b.rank);
    setSpots(found.slice(0, 80));
    const best = found.filter((s) => s.top).length;
    setStatusText(
      found.length
        ? `Found ${found.length} spots here${best ? ` · ${best} prime rare-car spot${best > 1 ? "s" : ""}` : ""}. Pan to explore more.`
        : "No rare-car spots in this exact area — pan to a town/city.",
    );
  }, []);

  // Fetch whenever the visible area settles (no geolocation required).
  function handleViewport(vp: { center: [number, number]; zoom: number }) {
    if (vp.zoom < 9) {
      setStatusText("Zoom in to a city to see rare-car spots.");
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => findSpots(vp.center[1], vp.center[0]), 700);
  }

  function locate() {
    if (!("geolocation" in navigator)) return;
    setStatusText("Locating you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12, duration: 1200 }),
      () => setStatusText("Couldn't get your location — pan the map to your area."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  // On mount: try to fly to the user; if denied, fly to a default city so pins show.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const flyDefault = () => {
      mapRef.current?.flyTo({ center: DEFAULT_CENTER, zoom: 11, duration: 800 });
      setStatusText("Showing Los Angeles — use Find spots near me to jump to your area.");
    };
    const t = setTimeout(() => {
      if (!("geolocation" in navigator)) return flyDefault();
      navigator.geolocation.getCurrentPosition(
        (pos) => mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12, duration: 1200 }),
        () => flyDefault(),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }, 400); // let the map initialize first
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      <div className="h-[440px] w-full overflow-hidden rounded-2xl border border-foreground/[0.06]">
        <Map ref={mapRef} center={DEFAULT_CENTER} zoom={4} onViewportChange={handleViewport}>
          {spots.map((s) => (
            <MapMarker key={s.id} longitude={s.lng} latitude={s.lat}>
              <MarkerContent>
                <div
                  className="size-3.5 rounded-full border-2 border-black shadow-lg transition-transform hover:scale-150"
                  style={{ background: s.color }}
                />
                {s.top && (
                  <MarkerLabel position="bottom" className="rounded bg-black/70 text-white px-1 text-neon-red">
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

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs ">
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
          className="rounded-xl bg-foreground/[0.06] px-4 py-2 text-sm font-medium hover:bg-foreground/[0.12]"
        >
          Find spots near me
        </button>
      </div>
      <p className="mt-2 text-sm ">{statusText}</p>
    </div>
  );
}

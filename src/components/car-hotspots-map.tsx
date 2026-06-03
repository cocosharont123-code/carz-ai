"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, MapMouseEvent, MapGeoJSONFeature } from "maplibre-gl";
import { Map, MapControls, MapPopup, useMap, type MapRef } from "@/components/ui/mapcn-layer-markers";

type Spot = {
  id: string;
  name: string;
  category: string;
  color: string;
  lng: number;
  lat: number;
};

type Selected = Spot & { coordinates: [number, number] };

const CATS = {
  luxury: { color: "#fbbf24", label: "Luxury dealer" },
  dealer: { color: "#38bdf8", label: "Car dealer" },
  shop: { color: "#a78bfa", label: "Tuner / auto shop" },
  wash: { color: "#34d399", label: "Detailing / car wash" },
  track: { color: "#fb7185", label: "Race track" },
};

// Brands that mark a dealer as "luxury / exotic" by name.
const LUX_RE =
  /porsche|ferrari|lamborghini|maserati|bentley|rolls.?royce|aston.?martin|mclaren|bugatti|lotus|koenigsegg|bmw|mercedes|audi|jaguar|land.?rover|range.?rover|tesla|lexus|alfa.?romeo|cadillac|genesis|acura|infiniti|polestar|lucid/i;

function catKeyFor(tags: Record<string, string>): keyof typeof CATS | null {
  if (tags.leisure === "track") return "track";
  if (tags.amenity === "car_wash") return "wash";
  if (tags.shop === "car_repair") return "shop";
  if (tags.shop === "car") return LUX_RE.test(tags.name || "") ? "luxury" : "dealer";
  return null;
}

// Multiple Overpass endpoints — the public one is often overloaded, so we fall
// back through mirrors until one responds.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

type OverpassEl = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

async function fetchOverpass(query: string): Promise<{ elements?: OverpassEl[] } | null> {
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

const SOURCE_ID = "car-hotspots";
const LAYER_ID = "car-hotspots-points";

function HotspotsLayer({
  spots,
  onSelect,
}: {
  spots: Spot[];
  onSelect: (s: Selected | null) => void;
}) {
  const { map, isLoaded } = useMap();
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!map || !isLoaded) return;
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 7,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#000000",
        },
      });
    }

    const handleClick = (e: MapMouseEvent & { features?: MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const p = f.properties as Record<string, string>;
      onSelectRef.current({
        id: p.id,
        name: p.name,
        category: p.category,
        color: p.color,
        lng: coords[0],
        lat: coords[1],
        coordinates: coords,
      });
    };
    const enter = () => (map.getCanvas().style.cursor = "pointer");
    const leave = () => (map.getCanvas().style.cursor = "");
    map.on("click", LAYER_ID, handleClick);
    map.on("mouseenter", LAYER_ID, enter);
    map.on("mouseleave", LAYER_ID, leave);

    return () => {
      map.off("click", LAYER_ID, handleClick);
      map.off("mouseenter", LAYER_ID, enter);
      map.off("mouseleave", LAYER_ID, leave);
    };
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData({
      type: "FeatureCollection",
      features: spots.map((s) => ({
        type: "Feature" as const,
        properties: { id: s.id, name: s.name, category: s.category, color: s.color },
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
      })),
    });
  }, [map, isLoaded, spots]);

  return null;
}

export function CarHotspotsMap() {
  const mapRef = useRef<MapRef>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [selected, setSelected] = useState<Selected | null>(null);
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
    try {
      const data = await fetchOverpass(query);
      if (!data) {
        setStatusText("All map servers are busy right now — tap the 📍 button to retry.");
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
        const cat = CATS[key];
        const id = `${el.type}/${el.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        found.push({
          id,
          name: tags.name || cat.label,
          category: cat.label,
          color: cat.color,
          lng: plon,
          lat: plat,
        });
      }
      // luxury dealers and tracks first so they win when crowded
      found.sort((a, b) => Number(b.category === CATS.luxury.label) - Number(a.category === CATS.luxury.label));
      setSpots(found);
      const lux = found.filter((s) => s.category === CATS.luxury.label).length;
      setStatusText(
        found.length
          ? `Found ${found.length} spots nearby${lux ? ` · ${lux} luxury dealer${lux > 1 ? "s" : ""}` : ""}.`
          : "Nothing found here — pan to a city and tap the locate button.",
      );
    } catch {
      setStatusText("Map service is busy — tap the locate button to retry.");
    }
  }

  // Auto-locate on first load so the map fills in without a click.
  useEffect(() => {
    if (located.current) return;
    located.current = true;
    if (!("geolocation" in navigator)) {
      setStatusText("Location unavailable — pan the map and tap the locate button.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 11, duration: 1200 });
        findSpots(latitude, longitude);
      },
      () => {
        setStatusText("Allow location (or tap the 📍 button) to find car spots near you.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  return (
    <div>
      <div className="h-[420px] w-full overflow-hidden rounded-2xl border border-white/[0.06]">
        <Map ref={mapRef} viewport={{ center: [-98, 39], zoom: 3.4 }}>
          <HotspotsLayer spots={spots} onSelect={setSelected} />
          <MapControls
            showZoom
            showLocate
            onLocate={({ latitude, longitude }) => findSpots(latitude, longitude)}
          />
          {selected && (
            <MapPopup
              longitude={selected.coordinates[0]}
              latitude={selected.coordinates[1]}
              onClose={() => setSelected(null)}
              closeOnClick={false}
              offset={12}
              closeButton
            >
              <div className="min-w-32">
                <p className="font-semibold">{selected.name}</p>
                <p className="text-sm text-muted-foreground">{selected.category}</p>
              </div>
            </MapPopup>
          )}
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
      <p className="mt-2 text-sm text-muted-foreground">{statusText}</p>
    </div>
  );
}

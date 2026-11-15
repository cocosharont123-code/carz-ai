"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPinOff, Search } from "lucide-react";
import { claimGpu } from "@/components/camera/camera-in-use";
import { applyRealism } from "@/components/map/realistic";
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
 * The real city, from above.
 *
 * Satellite photography in its own colours, 3D buildings standing on it and
 * real elevation under it, looking straight down -- the view you get from a
 * map, not from a helicopter banking over the city.
 *
 * It opened tilted at 62 degrees, which looked like altitude and meant the
 * first thing anybody did was press the flatten button to see where anything
 * actually was. Straight down is the default now and the button tilts rather
 * than flattens: the cinematic angle is still one tap away, it is just no
 * longer in the way of reading the map.
 *
 * It was a midnight flight until now -- the imagery desaturated to grey, a
 * black sheet over the ground, roads redrawn as white lamps. Handsome, and a
 * monochrome photograph of a city, which is not what a map of real cars in
 * real places should look like.
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
/**
 * Straight down, north up, on both paths.
 *
 * Zoom 12.8 rather than the 12.5 the tilted view used: a plan view fits more
 * ground into the same screen than a pitched one, so holding the old number
 * would have opened further out than it looked before.
 */
const TOP_DOWN_VIEW = { zoom: 12.8, pitch: 0, bearing: 0 } as const;

/** Where the tilt button goes, and what it eases back from. */
const TILTED_VIEW = { pitch: 62, bearing: -15 } as const;

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

  /**
   * The token, from the build or from the server.
   *
   * NEXT_PUBLIC_MAPBOX_TOKEN is inlined at compile time, so when a deployment
   * sets it there is nothing to wait for and this renders exactly as it used
   * to. When it does not -- which is what left the live map off while the
   * local one drew -- the token comes from /api/map-token, which reads it out
   * of Blob. One fetch, once, before the map initialises.
   *
   * `undefined` means "not known yet" and is distinct from "" ("there isn't
   * one"): the first must not draw the Map is off card, or every visitor sees
   * it flash before the map appears.
   */
  const [token, setToken] = useState<string | undefined>(
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined,
  );
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  // Opens flat, so the control reads "Tilt the map" rather than "Flatten".
  const [tilted, setTilted] = useState(false);

  // Ask the server once, and only when the build did not supply one.
  useEffect(() => {
    if (token !== undefined) return;
    let cancelled = false;
    fetch("/api/map-token", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { token: "" }))
      .then((d) => {
        if (!cancelled) setToken(typeof d?.token === "string" ? d.token : "");
      })
      .catch(() => {
        if (!cancelled) setToken("");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !holder.current || map.current) return;
    const release = claimGpu();
    // How much map to draw, decided once here and never changed afterwards --
    // swapping the style at runtime is exactly what blanked this page. It was
    // called "cinematic" when it also chose the camera angle; it only chooses
    // the quality now, and the camera looks straight down either way.
    const quality: "rich" | "lite" = capableDevice() ? "rich" : "lite";

    try {
      mapboxgl.accessToken = token;
      const m = new mapboxgl.Map({
        container: holder.current,
        // Standard Satellite rather than satellite-streets: the photography
        // with 3D buildings, landmarks and labels standing on it rather than
        // flat beside it, lit as daylight by applyRealism. The lite fallback
        // is Standard -- vector, no raster tiles, far cheaper on a weak
        // device, and still in colour.
        style:
          quality === "rich"
            ? "mapbox://styles/mapbox/standard-satellite"
            : "mapbox://styles/mapbox/standard",
        center: [START.lng, START.lat],
        ...TOP_DOWN_VIEW,
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
        if (quality === "rich") applyRealism(m);
      });
      m.on("error", (e) => console.error("map error:", e?.error ?? e));

      map.current = m;
      // Deferred: a synchronous write here cascades renders, and the frame it
      // costs is one nobody sees.
      // Flat on arrival whichever path we took -- `quality` decides how much
      // map to draw, not which way the camera points.
      void Promise.resolve().then(() => setTilted(false));
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
    m.easeTo({
      pitch: next ? TILTED_VIEW.pitch : TOP_DOWN_VIEW.pitch,
      bearing: next ? TILTED_VIEW.bearing : TOP_DOWN_VIEW.bearing,
      duration: 800,
    });
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
          // corner-shape:round, explicitly. §3 sets `corner-shape: squircle`
          // on every element and exempts .rounded-full -- a class this
          // element cannot have, because Mapbox builds its marker from a bare
          // div outside React. Without it a 16px box with a 9999px radius
          // renders as a rounded square in Chromium, which is what the dot
          // had become: a white tile sitting where you are.
          "width:16px;height:16px;border-radius:9999px;corner-shape:round",
          "background:#ffffff",
          "box-shadow:0 0 0 4px rgba(255,255,255,0.25), 0 0 18px rgba(255,255,255,0.65)",
        ].join(";");
        marker.current = new mapboxgl.Marker({ element: dot }).setLngLat(at).addTo(m);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  /**
   * Fly to where you are, on arrival, without being asked to.
   *
   * The same call the button makes -- same permission prompt, same 2s flight,
   * same white dot -- just fired once when the map is ready. Opening on Miami
   * and waiting to be told to find you is a button press standing between
   * somebody and the only thing this screen is for.
   *
   * Three guards, and each one is a real case:
   *
   *  - Once per mount. `located` is a ref rather than state because flipping
   *    state here would re-run the effect that owns it.
   *  - Not when the URL names a spot. Opening a car's pin from a scan is a
   *    deliberate destination, and two flights racing for the camera is how
   *    you land between them.
   *  - Not before the map object exists. The token can arrive from the server
   *    a beat after mount, so this waits on `token` rather than on nothing.
   *
   * A refusal costs nothing: getCurrentPosition's error path only clears the
   * spinner, so a denied prompt leaves the map exactly where it opened.
   */
  const located = useRef(false);
  useEffect(() => {
    if (!token || wantedSpot || located.current) return;
    const m = map.current;
    if (!m) return;
    located.current = true;
    // After the style is up: flyTo before the first tiles are in flight is a
    // flight over grey squares.
    if (m.isStyleLoaded()) {
      locate();
    } else {
      m.once("load", locate);
    }
  }, [token, wantedSpot, locate]);

  // Nothing at all until the token question is settled -- see the note on the
  // state above. The map's own container is what fills the screen meanwhile.
  if (token === undefined) return <div className="h-full w-full" />;

  if (!token || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center px-6">
        <div className="glass-card w-full max-w-sm rounded-card p-6 text-center">
          <MapPinOff className="mx-auto h-7 w-7 opacity-50" strokeWidth={1.5} aria-hidden />
          <h2 className="display mt-3 text-[20px]">Map is off</h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed opacity-70">
            {!token
              ? "There is no Mapbox token on this deployment, so there is no map to draw."
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
    <div className="relative h-full w-full bg-background">
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
            className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/70"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search cars, events, or places"
            aria-label="Search the map"
            // map-glass, not glass-card: this floats over daylight imagery
            // now, where theme-coloured glass and theme-coloured text wash
            // out. White on a dim layer, in both themes.
            className="map-glass h-[52px] w-full rounded-full pl-11 pr-4 text-[15px] text-white outline-none [&::-webkit-search-cancel-button]:appearance-none"
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
        // Nearly opaque, not glass. The app's glass is a translucent panel
        // tuned against the page behind it; what is behind this is daylight
        // satellite photography, and over a green park the sheet's own text
        // was competing with street labels showing through it. 92% of the
        // page colour keeps it a surface in both themes and still reads as
        // something laid over the map rather than part of it.
        className="absolute inset-x-0 bottom-0 z-10 rounded-t-sheet border-t border-[var(--line-divider)] bg-background/92 px-5 pt-2 backdrop-blur-xl"
        // The map runs full-bleed under the tab bar, so this sheet has to keep
        // its own content clear of it: 1rem of padding left the row of cars
        // underneath the capsule. --nav-h is the bar plus whatever gap is
        // under it, which is the number that moves when the bar does.
        style={{ paddingBottom: "calc(var(--nav-h) + 0.75rem)" }}
      >
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-foreground/25" />
        <h2 className="mt-3 text-[17px] font-semibold text-foreground">Cars Near You</h2>

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
                <span className="block truncate text-[15px] font-semibold text-foreground">
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

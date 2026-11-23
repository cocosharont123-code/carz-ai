"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPin, MapPinOff, Navigation, Search } from "lucide-react";
import { claimGpu } from "@/components/camera/camera-in-use";
import { applySnapLook } from "@/components/map/snap-style";
import { MapHud } from "@/components/map/map-hud";
import { timeAgo } from "@/lib/time-ago";
import { RarityMeter } from "@/components/car/rarity-meter";

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
 * What the leaderboard knows about a spotted car: its photograph, and the
 * rarity it was scored at. Kept per scan so a pin can show the picture of the
 * car that was actually standing there.
 */
type BoardEntry = {
  id: string;
  image?: string;
  rarityScore: number;
  rarityReason?: string;
};

/** A geocoder result: somewhere to fly to. */
type Place = {
  id: string;
  /** "Miami" */
  name: string;
  /** "Miami, Florida, United States" */
  context: string;
  center: [number, number];
};

/**
 * A model of the city, seen from an angle.
 *
 * Plain extruded blocks on flat monochrome ground, tilted by default -- the
 * Snap Map read. It was satellite photography with terrain under it until
 * now; the look is in snap-style.ts and the reasoning with it.
 *
 * The camera opens pitched rather than straight down, which reverses an
 * earlier decision here and is the point of the restyle: blocks seen from
 * directly above are squares. The flatten button is a 2D/3D pill now, so the
 * plan view is one tap away and says what it is.
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
 * The 3D view, which is the default.
 *
 * 58 degrees is inside the 55-60 the brief asks for and short of the 62 this
 * had before, which at street zoom buries the far half of the screen in the
 * sides of buildings.
 *
 * Zoom 15.4 rather than the 12.8 a plan view opened at, because Standard
 * starts drawing extrusions in the mid-15s: at 12.8 there is nothing in 3D
 * to see. It is the one visible trade in this change -- a neighbourhood
 * instead of a metro area, so fewer pins are on screen at once. The sheet at
 * the bottom still lists every car, and the first thing the map does is fly
 * to where you are.
 *
 * The bearing is a few degrees off north so the grid runs diagonally, which
 * is what stops a tilted city from looking like a wall.
 */
const TILTED_VIEW = { zoom: 15.4, pitch: 58, bearing: -17 } as const;

/** What the 2D half of the pill eases to: straight down, north up. */
const TOP_DOWN_VIEW = { zoom: 15.4, pitch: 0, bearing: 0 } as const;

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
  /** spot id -> the spot, so ?spot= and the sheet can open the right card. */
  const byId = useRef<Map<string, Spot>>(new Map());
  /**
   * One popup, reused.
   *
   * Its contents are React rendered through a portal into this node, rather
   * than an HTML string passed to setHTML. The card shows the car's photo and
   * the rarity meter, and the meter is a component the scan screen and the
   * garage already use -- a second copy of it written as a template literal
   * is a second thing to keep in step with the first.
   */
  // State with a lazy initialiser rather than a ref: the portal reads this
  // during render, and a ref read during render is the thing React 19 lints
  // against. Created once, and never on the server, where there is no
  // document to create it with.
  const [popupHost] = useState<HTMLDivElement | null>(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );
  const popup = useRef<mapboxgl.Popup | null>(null);
  const [selected, setSelected] = useState<Spot | null>(null);
  /** The deep link is honoured once, not on every redraw. */
  const flown = useRef(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  /** scanId -> what the board holds for that scan. */
  const [board, setBoard] = useState<Map<string, BoardEntry>>(new Map());

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
  const [places, setPlaces] = useState<Place[]>([]);
  /** The request whose answer is still wanted. See the lookup below. */
  const placeSeq = useRef(0);
  // Opens tilted, so the pill starts on 3D.
  const [tilted, setTilted] = useState(true);
  /** Whether this device got the extrusions; see `quality` at startup. */
  const rich = useRef(true);

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
        // Standard, not Standard Satellite: vector, so the whole basemap is
        // configurable and there is no aerial photograph to tint. One style
        // on both paths now -- `quality` decides whether the buildings are
        // extruded, not which map is loaded, so a weak device gets the same
        // flat monochrome city without the blocks.
        style: "mapbox://styles/mapbox/standard",
        center: [START.lng, START.lat],
        ...TILTED_VIEW,
        // Mercator, not globe. At street zoom a globe is the same picture
        // with an atmosphere around it, and that atmosphere is blue -- the
        // one thing the palette rules out. It is also a frame cheaper.
        projection: { name: "mercator" },
        // Past 60 the horizon comes into the frame and the far distance has
        // to be drawn; this is a city block away from a right angle.
        maxPitch: 65,
        attributionControl: true,
        // High-inertia camera. Low linearity and low deceleration is what makes
        // a drag carry on and ease out rather than stopping under the finger;
        // maxSpeed is the ceiling that keeps a hard flick from flinging the
        // map across the world.
        dragPan: { linearity: 0.25, deceleration: 1800, maxSpeed: 1200 },
        dragRotate: true,
      });

      rich.current = quality === "rich";
      m.on("style.load", () => applySnapLook(m, quality === "rich"));
      m.on("error", (e) => console.error("map error:", e?.error ?? e));

      map.current = m;
      // Deferred: a synchronous write here cascades renders, and the frame it
      // costs is one nobody sees. Tilted on arrival on both paths -- the
      // pill starts on 3D because the camera does.
      void Promise.resolve().then(() => setTilted(true));
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
        const cars: (BoardEntry & { scanId?: string })[] = Array.isArray(d.cars) ? d.cars : [];
        const map = new Map<string, BoardEntry>();
        for (const c of cars) {
          if (!c.scanId) continue;
          map.set(c.scanId, {
            id: c.id,
            image: c.image,
            rarityScore: Number(c.rarityScore) || 0,
            rarityReason: c.rarityReason,
          });
        }
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

        // The card is React, rendered through a portal into one shared popup
        // -- see `selected` -- so the marker only has to say which spot was
        // tapped. No setPopup, no HTML string, no escaping by hand.
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setSelected(s);
        });
        /**
         * Upright at any pitch.
         *
         * Both alignments default to "auto", which already resolves to
         * viewport for a marker -- said out loud because the map is tilted
         * by default now, and "auto" is only correct until someone reads it
         * as "whatever the map is doing" and changes it.
         */
        return new mapboxgl.Marker({
          element: el,
          pitchAlignment: "viewport",
          rotationAlignment: "viewport",
        })
          .setLngLat([s.lng, s.lat])
          .addTo(m);
      });
      byId.current = new Map(spots.map((s) => [s.id, s]));
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
    m.once("moveend", () => {
      const spot = byId.current.get(wantedSpot);
      if (spot) setSelected(spot);
    });
  }, [spots, wantedSpot]);

  /**
   * The card, over the pin.
   *
   * One popup for the whole map, moved and refilled rather than one built per
   * marker: the contents are a React subtree, and a root per pin would mean
   * mounting and unmounting a few hundred of them every time the spot list
   * changes. The node it renders into is created once, here, and handed to
   * Mapbox as the popup's DOM content.
   *
   * Closing is the popup's own close button and a tap on the map, both of
   * which have to clear `selected` or the next tap on the same pin would set
   * state that is already set and open nothing.
   */
  useEffect(() => {
    const m = map.current;
    if (!m || !popupHost) return;
    if (!popup.current) {
      popup.current = new mapboxgl.Popup({
        offset: 18,
        closeButton: true,
        // Above the pin, always. Left to choose for itself Mapbox opens the
        // card downwards for a pin in the top half of the screen, and down
        // there it lands behind the Cars Near You sheet.
        anchor: "bottom",
        // The card has its own padding and its own corners; Mapbox's default
        // white box around it would be a second surface.
        className: "carz-map-popup",
        maxWidth: "260px",
      }).setDOMContent(popupHost);
      popup.current.on("close", () => setSelected(null));
    }
    if (!selected) {
      popup.current.remove();
      return;
    }
    /**
     * Move it if it is already up, rather than adding it again.
     *
     * Popup.addTo on a popup that is already on the map removes it first, and
     * remove() fires "close" -- which clears the selection a beat after this
     * set it. Tapping a second pin while a card was open therefore closed the
     * card instead of switching to the new one.
     */
    if (popup.current.isOpen()) {
      popup.current.setLngLat([selected.lng, selected.lat]);
    } else {
      popup.current.setLngLat([selected.lng, selected.lat]).addTo(m);
    }

    /**
     * Put the pin where its card fits.
     *
     * The card stands above the pin and is a little over 300px tall with the
     * photo, the meter and Directions in it, so a pin tapped in the top half
     * of the screen opens a card whose top is off it -- and Mapbox has no
     * auto-pan: it picks an anchor, not a camera.
     *
     * So the camera moves instead. offset is in pixels from the centre of
     * the container, +y being down, which parks the pin below the middle and
     * leaves the card the room it needs. Centre only, at the zoom and pitch
     * the viewer already has -- it is a nudge, not a flight.
     */
    m.easeTo({
      center: [selected.lng, selected.lat],
      offset: [0, 120],
      duration: 500,
      essential: true,
    });
  }, [selected, popupHost]);

  /**
   * Restyle when the theme changes.
   *
   * The look is applied once when the style loads, which is right for the
   * first paint and wrong the moment somebody switches theme in Settings with
   * the map already open. The theme is a class on <html>, so the class is
   * what this watches -- no event to subscribe to, and no plumbing through a
   * provider the map does not otherwise use.
   *
   * The whole look rather than only the light preset: the palette is two
   * palettes now, and relighting a dark-grey city for daylight leaves a
   * dark-grey city in a white app.
   */
  useEffect(() => {
    const html = document.documentElement;
    const relight = () => {
      const m = map.current;
      if (m) applySnapLook(m, rich.current);
    };
    const observer = new MutationObserver(relight);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [token]);

  // A tap on open water closes the card, the way tapping away from anything
  // else does.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const close = () => setSelected(null);
    m.on("click", close);
    return () => {
      m.off("click", close);
    };
  }, [token]);

  /**
   * The 2D/3D pill.
   *
   * Pitch and bearing only. Zoom is deliberately left alone: whatever the
   * viewer has framed is what they want to look at, and a toggle that also
   * zoomed would move the ground out from under the pin they were reading.
   *
   * 650ms with the app's own easing, inside §6's 200-350 for an interface
   * animation doubled for a camera move -- a pitch change that lands in
   * 300ms reads as a glitch rather than as the map tipping.
   */
  const toggleTilt = useCallback(() => {
    const m = map.current;
    if (!m) return;
    const next = !tilted;
    setTilted(next);
    m.easeTo({
      pitch: next ? TILTED_VIEW.pitch : TOP_DOWN_VIEW.pitch,
      bearing: next ? TILTED_VIEW.bearing : TOP_DOWN_VIEW.bearing,
      duration: 650,
      essential: true,
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
        // 16 rather than 14: the buildings are the view now, and 14 lands
        // above the zoom where Standard starts extruding them.
        m.flyTo({ center: at, zoom: 16, essential: true, duration: 2000 });
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
        marker.current = new mapboxgl.Marker({
          element: dot,
          pitchAlignment: "viewport",
          rotationAlignment: "viewport",
        })
          .setLngLat(at)
          .addTo(m);
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

  /**
   * Places, as you type.
   *
   * The field already filtered the pins on the map by make, model and
   * spotter; typing a city into it did nothing, which on a map is the one
   * thing a search box is for. Mapbox's geocoder answers that, and the token
   * the map is already drawing with is the token it takes.
   *
   * Debounced at 250ms: a request per keystroke is both a bill and a race,
   * and the answers would arrive out of order. `seq` is what settles that --
   * a reply that is not the newest request is dropped rather than rendered,
   * so a slow lookup for "mia" cannot overwrite a fast one for "miami".
   *
   * Five results, `types` limited to the things worth flying to. Addresses
   * are in there deliberately: "where was that car" is often a street.
   */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || !token) {
      // Deferred: a synchronous write in an effect body cascades renders.
      void Promise.resolve().then(() => setPlaces([]));
      return;
    }
    const mine = ++placeSeq.current;
    const timer = setTimeout(async () => {
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
          `?access_token=${encodeURIComponent(token)}&limit=5&language=en` +
          `&types=country,region,place,locality,neighborhood,address,poi`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (mine !== placeSeq.current) return; // a newer query is in flight
        const found: Place[] = (data?.features ?? [])
          .filter((f: { center?: unknown }) => Array.isArray(f.center) && f.center.length === 2)
          .map((f: { id: string; text: string; place_name: string; center: [number, number] }) => ({
            id: f.id,
            name: f.text,
            context: f.place_name,
            center: f.center,
          }));
        setPlaces(found);
      } catch {
        if (mine === placeSeq.current) setPlaces([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, token]);

  /** Fly to a result and put the field away. */
  const goToPlace = useCallback((place: Place) => {
    const m = map.current;
    setQuery("");
    setPlaces([]);
    if (!m) return;
    m.flyTo({
      center: place.center,
      // A country is not a street: zoom to what was actually asked for.
      zoom: /country|region/.test(place.id) ? 6 : /address|poi/.test(place.id) ? 16 : 12,
      duration: 2000,
      essential: true,
    });
  }, []);

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
      {/*
        touch-action:none and overscroll-behavior:none on the element that
        owns the gestures.
      
        Mapbox sets touch-action on its own canvas container, which stops a
        pinch from zooming the page while the finger is on the canvas -- and
        leaves the gutter between the canvas and this box, where a pinch is
        still the browser's. none here means every touch inside the map
        belongs to the map, and overscroll-behavior stops a drag that reaches
        the top of the world from turning into pull-to-refresh.
      */}
      <div
        ref={holder}
        className="h-full w-full"
        style={{ touchAction: "none", overscrollBehavior: "none" }}
      />

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

          {/* The places, under the field.
          
              Darker than the field above it, and deliberately: the field is
              52px of dim glass and reads fine, while a list this tall over
              daylight satellite imagery at the same alpha had street labels
              and restaurant names showing through its own text. 95% is where
              the imagery stops competing altogether: a menu is a surface, not
              a window, and the map is still right there around it.
          
              The pins are already filtered live on the map underneath, so
              there is nothing to list for them here -- this is only for the
              half of the query the map could not answer before. */}
          {places.length > 0 && (
            <ul className="absolute inset-x-0 top-[calc(100%+8px)] z-20 overflow-hidden border border-white/12 bg-black/[0.95] backdrop-blur-xl">
              {places.map((place, i) => (
                <li
                  key={place.id}
                  className={i === 0 ? "" : "border-t border-white/12"}
                >
                  <button
                    type="button"
                    onClick={() => goToPlace(place)}
                    className="press flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-white/60" strokeWidth={1.75} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-white">
                        {place.name}
                      </span>
                      <span className="block truncate text-[12px] text-white/60">
                        {place.context}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* The card goes into the popup Mapbox positions for us. */}
      {selected && popupHost
        ? createPortal(
            <SpotCard
              spot={selected}
              entry={selected.scanId ? board.get(selected.scanId) : undefined}
            />,
            popupHost,
          )
        : null}

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
                  m.once("moveend", () => setSelected(sp));
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

/**
 * The card for one spotted car.
 *
 * What a pin used to show was three lines of text built as an HTML string --
 * name, spotter, "rarity 83" -- which told you a rare car had been standing
 * there without showing you the car. This is the photograph the spotter took,
 * the same rounded frame the leaderboard uses for it, and the same rarity
 * meter the scan screen and the garage draw.
 *
 * Both of those come from the leaderboard entry for this scan, which is the
 * only place the photo exists: a spot record carries coordinates, a name and
 * a score, never an image. A car with no entry -- the board keeps one per
 * model, so plenty have none -- still gets its name, its spotter and its
 * score, which is exactly what the old popup had.
 *
 * No escaping by hand anywhere: this is React, so a car called
 * `<script>` is text.
 */
/**
 * Where to send someone who wants to drive to a car.
 *
 * Apple Maps on Apple hardware, Google Maps everywhere else. Both are plain
 * https links rather than the maps:// and geo: schemes, because a custom
 * scheme that no app claims fails silently in a webview, while
 * maps.apple.com opens the app on iOS and the web page on anything that does
 * not have it -- the link always goes somewhere.
 *
 * Coordinates only, never the car's name: a place name is a search, and a
 * search for "Ferrari F40" is a dealership. The pin is the point.
 */
function directionsUrl(lat: number, lng: number): string {
  const at = `${lat},${lng}`;
  const apple =
    typeof navigator !== "undefined" &&
    /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  return apple
    ? `https://maps.apple.com/?daddr=${at}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${at}`;
}

function SpotCard({ spot, entry }: { spot: Spot; entry?: BoardEntry }) {
  const name = `${spot.make} ${spot.model}`.trim();
  const score = entry?.rarityScore || spot.rarityScore;

  return (
    <div className="w-[232px] rounded-card bg-black/[0.92] p-3 text-white backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {entry?.image && (
          // A 76px square at the leaderboard's own 28% radius, so a car looks
          // the same wherever it turns up. Small deliberately: this is a card
          // over a map, and a photo the width of it buries the two things
          // underneath that say what the car is.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.image}
            alt={name}
            className="h-[76px] w-[76px] shrink-0 rounded-[28%] object-cover"
            loading="lazy"
            draggable={false}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight">{name}</p>
          <p className="mt-0.5 truncate text-[12px] text-white/60">{spot.spotter}</p>
          <p className="truncate text-[12px] text-white/60">{timeAgo(spot.at)}</p>
        </div>
      </div>

      {score > 0 && (
        // The meter carries its own mt-4, which is more air than a 228px card
        // wants; -mt-2 trims it without touching the component.
        <div className="-mt-2">
          <RarityMeter score={score} reason={entry?.rarityReason} />
        </div>
      )}

      {/* Directions, to the pin's own coordinates. Filled and first: it is
          the one thing on this card that leaves the app, and on a map of
          where cars were found, "how do I get there" is the question the
          card exists to answer. New tab, with rel=noopener, so the map keeps
          its WebGL context and its state while the maps app opens. */}
      <a
        href={directionsUrl(spot.lat, spot.lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="press mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-bold text-black"
      >
        <Navigation className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        Directions
      </a>

      {entry && (
        <Link
          href={`/leaderboard?car=${encodeURIComponent(entry.id)}`}
          className="press mt-1 flex min-h-11 items-center justify-center text-[13px] font-semibold text-white underline underline-offset-2"
        >
          See it on the leaderboard ›
        </Link>
      )}
    </div>
  );
}

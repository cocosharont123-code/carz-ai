"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ScanLine, Images, Trophy, Map as MapIcon, Crosshair,
  Bot, Crown, Calendar, Settings as SettingsIcon,
} from "lucide-react";
import {
  DraggableWidgetGrid,
  type WidgetItem,
  type WidgetSize,
} from "@/components/ui/draggable-widget-grid";
import { getGarage } from "@/lib/garage-local";

/**
 * Home, as widgets you can rearrange.
 *
 * Every number on this screen is read from the app. The widget grid's own demo
 * shipped eight tiles of simulated traffic -- fake run counts, fake costs, fake
 * latencies -- and none of that is here: a widget either shows something true
 * or it shows its name and nothing else, which is an honest navigation tile
 * rather than an invented statistic.
 *
 * Which is why several widgets are just an icon and a label. CarzBot, Events
 * and Settings have nothing countable behind them, so they count nothing.
 *
 * The arrangement is saved per device. Dragging something and finding it back
 * where it started on the next visit is worse than not being able to drag it.
 */

const KEY = "carz:home:widgets";

/** Sizes are the default arrangement; the order is whatever was last saved. */
const WIDGETS: (WidgetItem & { kind: Kind })[] = [
  { id: "scan", kind: "scan", size: "wide", label: "Scan a car" },
  { id: "garage", kind: "garage", size: "sm", label: "Garage" },
  { id: "leaderboard", kind: "leaderboard", size: "sm", label: "Leaderboard" },
  { id: "map", kind: "map", size: "sm", label: "Map" },
  { id: "hunt", kind: "hunt", size: "sm", label: "Hunt" },
  { id: "carzbot", kind: "carzbot", size: "sm", label: "CarzBot" },
  { id: "events", kind: "events", size: "sm", label: "Events and drops" },
  { id: "pricing", kind: "pricing", size: "wide", label: "Carz PRO and MAX" },
  { id: "settings", kind: "settings", size: "sm", label: "Settings" },
];

type Kind =
  | "scan" | "garage" | "leaderboard" | "map"
  | "hunt" | "carzbot" | "events" | "pricing" | "settings";

type Live = {
  scansLeft: number | null;
  unlimited: boolean;
  garage: number | null;
  rarest: number | null;
  spots: number | null;
  hunters: number | null;
  tier: "plus" | "max" | null;
};

const HREF: Record<Kind, string> = {
  scan: "/spot", garage: "/garage", leaderboard: "/leaderboard", map: "/map",
  hunt: "/hunt", carzbot: "/carzbot", events: "/events", pricing: "/pricing",
  settings: "/settings",
};

const ICON: Record<Kind, typeof ScanLine> = {
  scan: ScanLine, garage: Images, leaderboard: Trophy, map: MapIcon,
  hunt: Crosshair, carzbot: Bot, events: Calendar, pricing: Crown,
  settings: SettingsIcon,
};

const TITLE: Record<Kind, string> = {
  scan: "Scan", garage: "Garage", leaderboard: "Leaderboard", map: "Map",
  hunt: "Hunt", carzbot: "CarzBot", events: "Events", pricing: "Carz PRO",
  settings: "Settings",
};

export function HomeWidgets() {
  const [live, setLive] = useState<Live | null>(null);
  // Starts on the default arrangement rather than null.
  //
  // It was null until localStorage had been read, which meant Home rendered a
  // 520px empty box on the server and on first paint -- the same blank-first-
  // paint problem the sign-in page had. A saved arrangement usually matches the
  // default anyway, and when it does not the grid animates into place, which
  // reads as the layout settling rather than as a fault.
  const [order, setOrder] = useState<WidgetItem[]>(WIDGETS as WidgetItem[]);

  // The saved arrangement, deferred a microtask: localStorage is an external
  // system and a synchronous state write in an effect body cascades renders.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      let saved: string[] = [];
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) saved = JSON.parse(raw) as string[];
      } catch {
        // Unreadable or private browsing: the default order is fine.
      }
      const byId = new Map(WIDGETS.map((w) => [w.id, w as WidgetItem]));
      const kept = saved.map((id) => byId.get(id)).filter(Boolean) as WidgetItem[];
      // Anything added since the arrangement was saved goes on the end rather
      // than disappearing because an old list did not mention it.
      const rest = WIDGETS.filter((w) => !saved.includes(w.id)) as WidgetItem[];
      setOrder([...kept, ...rest]);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const json = (r: Response) => (r.ok ? r.json() : null);
    Promise.all([
      fetch("/api/me", { cache: "no-store" }).then(json).catch(() => null),
      fetch("/api/membership", { cache: "no-store" }).then(json).catch(() => null),
      fetch("/api/leaderboard", { cache: "no-store" }).then(json).catch(() => null),
      fetch("/api/spots", { cache: "no-store" }).then(json).catch(() => null),
      fetch("/api/hunt/enter", { cache: "no-store" }).then(json).catch(() => null),
      Promise.resolve().then(() => getGarage()).catch(() => null),
    ]).then(([me, mem, board, spots, hunt, garage]) => {
      if (cancelled) return;
      const status = me?.status;
      const cap = status?.dailyLimit ?? null;
      const used = status?.usedToday ?? null;
      setLive({
        unlimited: !!status?.member && cap === null,
        scansLeft: cap != null && used != null ? Math.max(0, cap - used) : null,
        garage: Array.isArray(garage) ? garage.length : null,
        rarest: Array.isArray(board?.cars) && board.cars.length
          ? Math.round(board.cars[0].rarityScore)
          : null,
        spots: Array.isArray(spots?.spots) ? spots.spots.length : null,
        hunters: typeof hunt?.count === "number" ? hunt.count : null,
        tier: mem?.tier ?? null,
      });
    });
    return () => { cancelled = true; };
  }, []);

  const save = useCallback((next: WidgetItem[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next.map((w) => w.id)));
    } catch {
      // Private browsing. The arrangement holds for this session only, which
      // is not worth an error message.
    }
  }, []);

  const render = useCallback(
    (item: WidgetItem, size: WidgetSize) => {
      const kind = (WIDGETS.find((w) => w.id === item.id)?.kind ?? "scan") as Kind;
      return <WidgetFace kind={kind} size={size} live={live} />;
    },
    [live],
  );

  return (
    <DraggableWidgetGrid
      className="mt-6"
      items={order}
      onChange={save}
      renderItem={render}
      maxColumns={2}
      cellSize={170}
      gap={12}
      radius={20}
    />
  );
}

/** The inside of a widget: a link, with a figure when there is one. */
function WidgetFace({ kind, size, live }: { kind: Kind; size: WidgetSize; live: Live | null }) {
  const Icon = ICON[kind];

  /** The number, or null when this widget has nothing countable behind it. */
  let value: string | null = null;
  let caption: string | null = null;

  if (live) {
    if (kind === "scan") {
      value = live.unlimited ? "Unlimited" : live.scansLeft != null ? String(live.scansLeft) : null;
      caption = live.unlimited ? "scans today" : "scans left today";
    } else if (kind === "garage" && live.garage != null) {
      value = String(live.garage);
      caption = live.garage === 1 ? "car saved" : "cars saved";
    } else if (kind === "leaderboard" && live.rarest != null) {
      value = String(live.rarest);
      caption = "rarest found";
    } else if (kind === "map" && live.spots != null) {
      value = String(live.spots);
      caption = live.spots === 1 ? "spot nearby" : "spots nearby";
    } else if (kind === "hunt" && live.hunters != null) {
      value = String(live.hunters);
      caption = live.hunters === 1 ? "hunter in" : "hunters in";
    } else if (kind === "pricing") {
      value = live.tier === "max" ? "Carz MAX" : live.tier === "plus" ? "Carz PRO" : null;
      caption = live.tier ? "you're in" : null;
    }
  }

  return (
    <Link
      href={HREF[kind]}
      className="flex h-full w-full flex-col justify-between p-4"
      // Dragging a widget must not also follow its link. The grid swallows the
      // click that follows a drop; this stops the browser's own drag as well.
      draggable={false}
    >
      <Icon className="h-6 w-6 shrink-0 text-foreground" strokeWidth={1.75} aria-hidden />

      <span className="min-w-0">
        {value && (
          <span
            className={`block truncate font-bold leading-none text-foreground ${
              size === "sm" ? "text-[20px]" : "text-[34px]"
            }`}
          >
            {value}
          </span>
        )}
        <span className="mt-1 block truncate text-[15px] font-semibold text-foreground">
          {TITLE[kind]}
        </span>
        {caption && (
          <span className="block truncate text-[14px] text-[var(--color-secondary-text)]">
            {caption}
          </span>
        )}
      </span>
    </Link>
  );
}

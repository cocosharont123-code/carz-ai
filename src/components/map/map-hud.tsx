"use client";

import { Crosshair, Mountain, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type MapQuality = "cinematic" | "flat";

/**
 * The heads-up card.
 *
 * Controls rather than decoration: where am I, is this tilted or flat, and is
 * the expensive version on. The last one is not a nicety — satellite tiles, a
 * terrain mesh and a globe together are the heaviest thing in this app, and a
 * phone that cannot hold them needs a way back that is not "reload and hope".
 */
export function MapHud({
  quality,
  onQuality,
  tilted,
  onTilt,
  onLocate,
  locating,
}: {
  quality: MapQuality;
  onQuality: (q: MapQuality) => void;
  tilted: boolean;
  onTilt: () => void;
  onLocate: () => void;
  locating: boolean;
}) {
  return (
    <div
      className="absolute left-3 z-10 w-[13.5rem] rounded-2xl border border-white/10 bg-zinc-950/60 p-3 text-white backdrop-blur-xl"
      style={{ top: "calc(var(--safe-top) + 0.75rem)" }}
    >
      <p className="util-label px-1 opacity-50">Map</p>

      <div className="mt-2 space-y-1.5">
        <Row
          Icon={Crosshair}
          label={locating ? "Finding you…" : "My location"}
          onClick={onLocate}
          disabled={locating}
        />
        <Row
          Icon={Mountain}
          label={tilted ? "Flatten" : "Tilt"}
          onClick={onTilt}
        />
        <Row
          Icon={Sparkles}
          label={quality === "cinematic" ? "Cinematic on" : "Cinematic off"}
          active={quality === "cinematic"}
          onClick={() => onQuality(quality === "cinematic" ? "flat" : "cinematic")}
        />
      </div>
    </div>
  );
}

function Row({
  Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  Icon: typeof Crosshair;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "press flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] font-semibold transition-colors",
        active ? "bg-carz/15 text-carz" : "hover:bg-white/[0.06]",
        disabled && "opacity-50",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

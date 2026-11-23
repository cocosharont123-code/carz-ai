"use client";

import { Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Two controls, right-hand side, in the app's glass.
 *
 * It was a card on the left with a third control in it that swapped the whole
 * map style. That one blanked the page: setStyle tears down everything the map
 * holds, and terrain still pointing at a source that no longer exists takes the
 * canvas with it. The switch is gone rather than patched — the map picks its
 * quality once, at startup, from what the device reports, and never changes it
 * underneath itself.
 *
 * The tilt control was a mountain icon whose meaning depended on which way the
 * camera happened to be pointing. It is a 2D/3D pill now: both states are on
 * screen, the current one is filled, and nothing has to be pressed to find out
 * what the button does.
 */
export function MapHud({
  tilted,
  onTilt,
  onLocate,
  locating,
}: {
  tilted: boolean;
  onTilt: () => void;
  onLocate: () => void;
  locating: boolean;
}) {
  return (
    <div
      className="absolute right-3 z-10 flex flex-col items-end gap-2"
      style={{ top: "calc(var(--safe-top) + 0.75rem)" }}
    >
      <button
        type="button"
        onClick={onLocate}
        disabled={locating}
        aria-label={locating ? "Finding you…" : "Centre on my location"}
        title={locating ? "Finding you…" : "Centre on my location"}
        className={cn(
          // 44px: small, but a control on a map is dragged past constantly and
          // anything under the minimum becomes a control you fight for.
          // map-glass rather than the app's glass-bubble: these sit over the
          // map, which is a surface of its own in both themes.
          "press map-glass flex h-11 w-11 items-center justify-center rounded-full",
          "transition-colors disabled:opacity-50",
        )}
      >
        <Crosshair
          className={cn("h-[18px] w-[18px]", locating && "animate-pulse")}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      <DimensionPill tilted={tilted} onTilt={onTilt} />
    </div>
  );
}

/**
 * 2D | 3D.
 *
 * One moving part: a filled capsule that slides between the halves while the
 * camera eases between pitch 0 and 58. Transform only -- it is the one thing
 * on this screen animating next to a map that is redrawing every frame, and a
 * width or a left would relayout the pill on each of those frames.
 *
 * Two buttons rather than one that toggles, so each half can say what it
 * selects and aria-pressed can be true on exactly one of them. Pressing the
 * half that is already active does nothing, which is what a segmented control
 * does; `onTilt` flips, so it has to be guarded here.
 */
function DimensionPill({ tilted, onTilt }: { tilted: boolean; onTilt: () => void }) {
  return (
    <div
      className="map-glass relative flex h-11 overflow-hidden rounded-full p-1"
      role="group"
      aria-label="Map dimension"
    >
      {/* The indicator. Inset by the padding, half the inner width, and moved
          by its own width rather than by a pixel count, so the two halves stay
          the same whatever the type metrics do. */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-11 rounded-full bg-white transition-transform duration-[650ms]"
        style={{ transform: tilted ? "translateX(100%)" : "translateX(0)" }}
      />
      {([false, true] as const).map((wants3d) => {
        const active = tilted === wants3d;
        return (
          <button
            key={String(wants3d)}
            type="button"
            onClick={() => {
              if (!active) onTilt();
            }}
            aria-pressed={active}
            aria-label={wants3d ? "Tilt the map" : "Flatten the map"}
            className={cn(
              // 44 wide each: the pill is two tap targets, not one split in
              // half and hoped for.
              "relative z-10 w-11 text-[13px] font-bold transition-colors",
              active ? "text-black" : "text-white/70",
            )}
          >
            {wants3d ? "3D" : "2D"}
          </button>
        );
      })}
    </div>
  );
}

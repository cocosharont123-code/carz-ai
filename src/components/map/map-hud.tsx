"use client";

import { Crosshair, Mountain } from "lucide-react";
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
      className="absolute right-3 z-10 flex flex-col gap-2"
      style={{ top: "calc(var(--safe-top) + 0.75rem)" }}
    >
      <Toggle
        Icon={Crosshair}
        label={locating ? "Finding you…" : "Centre on my location"}
        onClick={onLocate}
        disabled={locating}
        busy={locating}
      />
      <Toggle
        Icon={Mountain}
        label={tilted ? "Flatten the map" : "Tilt the map"}
        onClick={onTilt}
        active={tilted}
      />
    </div>
  );
}

function Toggle({
  Icon,
  label,
  onClick,
  active,
  disabled,
  busy,
}: {
  Icon: typeof Crosshair;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        // 44px: small, but a control on a map is dragged past constantly and
        // anything under the minimum becomes a control you fight for.
        "press glass-bubble flex h-11 w-11 items-center justify-center rounded-full",
        "transition-colors disabled:opacity-50",
        active && "text-carz",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px]", busy && "animate-pulse")} strokeWidth={2} aria-hidden />
    </button>
  );
}

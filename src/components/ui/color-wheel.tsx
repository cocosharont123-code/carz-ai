"use client";

import { useCallback, useRef, useState } from "react";
import { hexToHsl, hslToHex } from "@/lib/customizer-options";
import { cn } from "@/lib/utils";

/**
 * A squircle colour wheel.
 *
 * Hue runs around it and saturation runs out from the middle, which is the
 * usual polar wheel — the shape is a squircle rather than a circle, so the
 * corners sit past full saturation and clamp to it. That costs nothing: every
 * colour is still reachable, the corners just repeat the rim.
 *
 * Lightness cannot live on a wheel, so it is a slider underneath. Without one
 * the whole dark half of the range is unreachable — no black, no charcoal, no
 * deep green — and the swatch list this replaced had all three.
 *
 * The native colour input beside the readout is not decoration: a drag target
 * is unusable by keyboard or switch control, and that input is the platform's
 * own picker, which is.
 */
export function ColorWheel({
  value,
  onChange,
  className,
  label = "Body colour",
}: {
  /** Current hex, or "" for nothing picked yet. */
  value: string;
  onChange: (hex: string) => void;
  className?: string;
  label?: string;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  // Hue and saturation come from the pad, lightness from the slider. Kept here
  // rather than derived from `value` on every render: round-tripping through
  // hex loses hue at the grey end, so dragging into the middle would lose the
  // hue you had and never give it back.
  const initial = value ? hexToHsl(value) : { h: 210, s: 0.9, l: 0.5 };
  const [hsl, setHsl] = useState(initial);

  const emit = useCallback(
    (next: { h: number; s: number; l: number }) => {
      setHsl(next);
      onChange(hslToHex(next.h, next.s, next.l));
    },
    [onChange],
  );

  const pick = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = (clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (clientY - (r.top + r.height / 2)) / (r.height / 2);
      // Corners of a squircle exceed radius 1; saturation stops at the rim.
      const sat = Math.min(1, Math.hypot(dx, dy));
      // conic-gradient starts at twelve o'clock and runs clockwise; atan2
      // starts at three o'clock, hence the quarter turn.
      const hue = (((Math.atan2(dy, dx) * 180) / Math.PI + 90) + 360) % 360;
      emit({ ...hsl, h: hue, s: sat });
    },
    [emit, hsl],
  );

  const hex = hslToHex(hsl.h, hsl.s, hsl.l);
  // The marker follows hue and saturation, so it stays put as lightness moves.
  const markerAngle = ((hsl.h - 90) * Math.PI) / 180;
  const markerX = 50 + Math.cos(markerAngle) * hsl.s * 50;
  const markerY = 50 + Math.sin(markerAngle) * hsl.s * 50;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        ref={padRef}
        role="application"
        aria-label={`${label} wheel. Use the colour input below for an exact value.`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) pick(e.clientX, e.clientY);
        }}
        className="relative aspect-square w-full max-w-[268px] cursor-crosshair touch-none overflow-hidden rounded-[28%] border border-black/15 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_10px_28px_-14px_rgba(0,0,0,0.55)]"
      >
        {/* Hue around, saturation outward. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, #fff 0%, rgba(255,255,255,0) 72%)",
          }}
        />
        {/* Lightness, painted over the top rather than baked into the wheel, so
            the wheel itself never has to be redrawn. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: hsl.l < 0.5 ? "#000" : "#fff",
            opacity: hsl.l < 0.5 ? 1 - hsl.l * 2 : (hsl.l - 0.5) * 2,
          }}
        />
        <span
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.5)]"
          style={{ left: `${markerX}%`, top: `${markerY}%`, background: hex }}
        />
      </div>

      <label className="mt-4 w-full max-w-[268px]">
        <span className="util-label opacity-60">Lightness</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(hsl.l * 100)}
          onChange={(e) => emit({ ...hsl, l: Number(e.target.value) / 100 })}
          className="mt-1.5 h-11 w-full cursor-pointer accent-carz"
        />
      </label>

      <div className="mt-1 flex w-full max-w-[268px] items-center gap-3">
        <label
          className="press relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/20"
          style={{ background: hex }}
        >
          <span className="sr-only">Exact {label.toLowerCase()}</span>
          <input
            type="color"
            value={hex}
            onChange={(e) => emit(hexToHsl(e.target.value))}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <span className="font-mono text-sm uppercase opacity-70">{hex}</span>
      </div>
    </div>
  );
}

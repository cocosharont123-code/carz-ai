"use client";

import { useEffect, useRef, useState } from "react";
import { useAnimate } from "framer-motion";
import { cn } from "@/lib/utils";

/** When Carz AI lands on the App Store. */
export const RELEASE_DATE = "2026-10-05T00:00:00";
/** Written out. Kept beside the date above so the two cannot disagree. */
export const RELEASE_LABEL = "October 5, 2026";

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

export type CountdownUnit = "Day" | "Hour" | "Minute" | "Second";

const LABELS: Record<CountdownUnit, string> = {
  Day: "Days",
  Hour: "Hours",
  Minute: "Minutes",
  Second: "Seconds",
};

const ALL_UNITS: CountdownUnit[] = ["Day", "Hour", "Minute", "Second"];

/**
 * A countdown whose digits roll over rather than blink.
 *
 * Three changes from the component as published, all forced by this codebase:
 *
 *  1. It is typed. The original takes `{ unit, label }` and `useTimer(unit)`
 *     untyped, which does not compile under this project's TypeScript.
 *     `end - now` on two Dates is also a type error; it needs `getTime()`.
 *
 *  2. The full-screen `min-h-screen bg-white dark:bg-black` wrapper is gone.
 *     It was a demo page, and a component that insists on owning the viewport
 *     and painting its own background cannot be placed inside one. Layout
 *     belongs to whoever renders this.
 *
 *  3. `units` is a prop. The homepage asks for days, hours and minutes; the
 *     default is still all four.
 */
export default function ShiftingCountdown({
  target = RELEASE_DATE,
  units = ALL_UNITS,
  className,
}: {
  target?: string;
  units?: CountdownUnit[];
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-start justify-center", className)}>
      {units.map((unit) => (
        <CountdownItem key={unit} unit={unit} label={LABELS[unit]} target={target} />
      ))}
    </div>
  );
}

function CountdownItem({
  unit,
  label,
  target,
}: {
  unit: CountdownUnit;
  label: string;
  target: string;
}) {
  const { ref, time } = useTimer(unit, target);
  // Everything but days reads as a clock, so it keeps its leading zero.
  const display = unit === "Day" ? String(time) : String(time).padStart(2, "0");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-6 sm:px-4 md:gap-2 md:py-8">
      <div className="relative w-full overflow-hidden text-center">
        <span
          ref={ref}
          className="block font-mono text-4xl font-semibold tabular-nums text-white sm:text-5xl md:text-6xl lg:text-7xl"
        >
          {display}
        </span>
      </div>
      <span className="util-label opacity-60">{label}</span>
      <div className="mt-4 h-px w-full bg-white/15" />
    </div>
  );
}

function useTimer(unit: CountdownUnit, target: string) {
  const [ref, animate] = useAnimate<HTMLSpanElement>();
  const intervalRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const [time, setTime] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const remaining = (): number => {
      // getTime(): subtracting two Dates is a type error, and the original
      // relied on the implicit coercion JavaScript allows and TypeScript does not.
      const distance = new Date(target).getTime() - Date.now();
      switch (unit) {
        case "Day":
          return Math.max(0, Math.floor(distance / DAY));
        case "Hour":
          return Math.max(0, Math.floor((distance % DAY) / HOUR));
        case "Minute":
          return Math.max(0, Math.floor((distance % HOUR) / MINUTE));
        default:
          return Math.max(0, Math.floor((distance % MINUTE) / SECOND));
      }
    };

    const tick = async () => {
      const next = remaining();
      if (next === timeRef.current) return;
      // No element yet, or gone: skip rather than write state, which keeps
      // every state change behind an await and out of the effect body.
      if (!ref.current) return;

      await animate(ref.current, { y: ["0%", "-50%"], opacity: [1, 0] }, { duration: 0.35 });
      if (cancelled) return;
      timeRef.current = next;
      setTime(next);
      await animate(ref.current, { y: ["50%", "0%"], opacity: [0, 1] }, { duration: 0.35 });
    };

    void tick();
    intervalRef.current = window.setInterval(() => void tick(), 1000);

    return () => {
      cancelled = true;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [unit, target, animate, ref]);

  return { ref, time };
}

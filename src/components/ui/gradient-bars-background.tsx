"use client";

import React from "react";

/**
 * A row of gradient bars that breathe, as a full-bleed background.
 *
 * Reproduced as supplied, with three changes it needed to build here.
 *
 * "use client" at the top: it animates and is dropped into an App Router tree,
 * where a component without it is a server component and cannot carry one.
 *
 * The inline <style> block became a module-level constant injected once rather
 * than re-declared by every instance — two of these on a page would otherwise
 * define the same keyframes twice.
 *
 * And the CSS custom property is typed rather than @ts-ignore'd. A style object
 * genuinely can carry a custom property; the cast says so, where the ignore
 * silenced whatever else might be wrong on that line too.
 *
 * Since then, a fourth: each bar carries a class so the animation can be turned
 * off under prefers-reduced-motion. It has to be !important, because the
 * animation is an inline style and nothing in a stylesheet outranks one.
 */

interface GradientBarsProps {
  numBars?: number;
  gradientFrom?: string;
  gradientTo?: string;
  animationDuration?: number;
  className?: string;
}

const KEYFRAMES = `
@keyframes pulseBar {
  0% { transform: scaleY(var(--initial-scale)); }
  100% { transform: scaleY(calc(var(--initial-scale) * 0.7)); }
}
@media (prefers-reduced-motion: reduce) {
  .gradient-bar { animation: none !important; }
}`;

/**
 * Tallest at the edges, shortest in the middle. The exponent shapes how quickly
 * the bars climb away from centre — above 1 it stays flat through the middle
 * and rises hard at the ends, which is what gives the row its curve.
 */
const calculateHeight = (index: number, total: number) => {
  const position = index / (total - 1);
  const maxHeight = 100;
  const minHeight = 30;

  const center = 0.5;
  const distanceFromCenter = Math.abs(position - center);
  const heightPercentage = Math.pow(distanceFromCenter * 2, 1.2);

  return minHeight + (maxHeight - minHeight) * heightPercentage;
};

const GradientBars: React.FC<GradientBarsProps> = ({
  numBars = 15,
  gradientFrom = "rgb(255, 60, 0)",
  gradientTo = "transparent",
  animationDuration = 2,
  className = "",
}) => (
  <>
    <style>{KEYFRAMES}</style>

    <div className={`absolute inset-0 z-0 overflow-hidden ${className}`} aria-hidden>
      <div
        className="flex h-full"
        style={{
          width: "100%",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {Array.from({ length: numBars }).map((_, index) => {
          const height = calculateHeight(index, numBars);
          return (
            <div
              key={index}
              className="gradient-bar"
              style={
                {
                  flex: `1 0 calc(100% / ${numBars})`,
                  maxWidth: `calc(100% / ${numBars})`,
                  height: "100%",
                  background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
                  transform: `scaleY(${height / 100})`,
                  transformOrigin: "bottom",
                  transition: "transform 0.5s ease-in-out",
                  animation: `pulseBar ${animationDuration}s ease-in-out infinite alternate`,
                  animationDelay: `${index * 0.1}s`,
                  outline: "1px solid rgba(0, 0, 0, 0)",
                  boxSizing: "border-box",
                  "--initial-scale": height / 100,
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  </>
);

interface ComponentProps {
  numBars?: number;
  gradientFrom?: string;
  gradientTo?: string;
  animationDuration?: number;
  backgroundColor?: string;
  children?: React.ReactNode;
}

export default function Component({
  numBars = 7,
  gradientFrom = "rgb(255, 60, 0)",
  gradientTo = "transparent",
  animationDuration = 2,
  backgroundColor = "rgb(10, 10, 10)",
  children,
}: ComponentProps) {
  return (
    <section
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor }}
    >
      <GradientBars
        numBars={numBars}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
        animationDuration={animationDuration}
      />

      {children && (
        <div className="relative z-10 w-full h-full flex items-center justify-center px-4">
          {children}
        </div>
      )}
    </section>
  );
}

export { Component, GradientBars };

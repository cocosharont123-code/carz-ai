import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   Carz editorial UI kit — the shared vocabulary every page composes from.
   Black surface · neon accents (blue #00E5FF · green #39FF14 · red #FF3131) · white · sharp edges.
   ========================================================================== */

/* --- Button: yellow solid, or white outline that fills yellow on hover ------ */
type ButtonProps = {
  href?: string;
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  target?: string;
};

// Liquid-glass pill with a neon (blue→green→red) gradient border + glow.
const GLASS =
  "border-2 border-transparent text-white [background:linear-gradient(rgba(255,255,255,0.07),rgba(255,255,255,0.07))_padding-box,linear-gradient(90deg,var(--color-neon-blue),var(--color-neon-green),var(--color-neon-red))_border-box] shadow-[0_0_20px_-6px_rgba(0,229,255,0.55)] hover:scale-[1.03] hover:shadow-[0_0_30px_-5px_rgba(57,255,20,0.6)]";

export function Button({ href, variant = "solid", size = "md", className, children, target, ...rest }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-display uppercase tracking-widest transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40";
  const variants = {
    solid: GLASS,
    outline: GLASS,
    ghost: "text-white/70 hover:text-white",
  };
  const sizes = {
    sm: "px-5 py-2 text-[11px]",
    md: "px-6 py-2.5 text-xs",
    lg: "px-8 py-3.5 text-sm",
  };
  const cls = cn(base, variants[variant], sizes[size], className);
  if (href) {
    return (
      <Link href={href} className={cls} target={target}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

/* --- Eyebrow / utility label ------------------------------------------------ */
export function Eyebrow({ children, className, yellow }: { children: ReactNode; className?: string; yellow?: boolean }) {
  return <div className={cn("util-label", yellow ? "text-carz" : "text-white/50", className)}>{children}</div>;
}

/* --- Card: dark surface, hairline border, sharp corners --------------------- */
export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-card",
        hover && "transition-colors hover:border-white/25",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* --- PageMasthead: giant condensed title + eyebrow + optional count --------- */
export function PageMasthead({
  title,
  eyebrow,
  count,
  action,
}: {
  title: string;
  eyebrow?: string;
  count?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="border-b border-white/10 pb-5">
      {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-6xl leading-[0.9] sm:text-7xl md:text-8xl">{title}</h1>
        <div className="flex items-center gap-4 pb-1">
          {count != null && <span className="util-label text-white/50">{count}</span>}
          {action}
        </div>
      </div>
    </header>
  );
}

/* --- SectionDivider: full-width bar, thin rules, centered label ------------- */
export function SectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-8 border-y border-white/10 py-3 text-center">
      <span className="util-label text-white/40">{children}</span>
    </div>
  );
}

/* --- StatRow: giant number + small caption, optional solid-yellow ----------- */
export function StatRow({
  value,
  label,
  yellow,
  className,
}: {
  value: ReactNode;
  label: string;
  yellow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-center rounded-2xl border border-white/10 p-6",
        yellow ? "bg-carz text-carz-ink" : "bg-card",
        className,
      )}
    >
      <div className="display text-5xl sm:text-6xl">{value}</div>
      <div className={cn("util-label mt-2", yellow ? "text-carz-ink/70" : "text-white/50")}>{label}</div>
    </div>
  );
}

/* --- DataTable: thin rules, utility headers, no zebra ----------------------- */
export type TableRow = { cells: ReactNode[]; highlight?: boolean; big?: boolean };

export function DataTable({
  head,
  rows,
  className,
}: {
  head?: string[];
  rows: TableRow[];
  className?: string;
}) {
  return (
    <table className={cn("w-full border-collapse text-left", className)}>
      {head && (
        <thead>
          <tr className="border-b border-white/15">
            {head.map((h, i) => (
              <th key={i} className="util-label px-3 py-2.5 text-white/45 first:pl-0 last:pr-0 last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={i}
            className={cn(
              "border-b border-white/10",
              r.highlight ? "bg-carz text-carz-ink" : "text-white/85",
            )}
          >
            {r.cells.map((c, j) => (
              <td
                key={j}
                className={cn(
                  "px-3 py-3 align-middle first:pl-3 last:pr-3 last:text-right",
                  r.highlight && "first:pl-3",
                  r.big && "py-4 text-lg font-semibold",
                )}
              >
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* --- CarPhoto: grayscale by default, full color on hover -------------------- */
export function CarPhoto({
  src,
  alt,
  className,
  fallback = "🚗",
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-white/[0.04] text-4xl grayscale", className)}>
        {fallback}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn("car-photo h-full w-full object-cover", className)} draggable={false} />
  );
}

/* --- Skeleton --------------------------------------------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/[0.06]", className)} />;
}

/* --- LiveDot: the single yellow live indicator ------------------------------ */
export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("carz-live-dot inline-block h-2 w-2 rounded-full bg-neon-green", className)} />;
}

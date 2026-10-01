import Link from "next/link";
import type { ReactNode } from "react";
import { Car, Search as SearchIcon, ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ==========================================================================
   The shared vocabulary every page composes from.

   Black, white, neutral grey. One accent and it is white; the only colour that
   survives here is a car's own photo.
   ========================================================================== */

/* --- Button: a white pill, or a surface pill with a brighter edge ----------- */
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
  /** Show a spinner and block clicks while an action is in flight. */
  loading?: boolean;
};

/**
 * Primary: solid white, black on it. The one thing on a screen that is
 * unmissable, so a screen should have at most one.
 *
 * Secondary: the same pill in surface grey with a brighter edge than a card
 * gets, which is the only thing separating a button you can press from a box
 * you cannot.
 *
 * Both were a milky white glass bubble with inset highlights and a scale-up on
 * hover. No glass, and no scale: a 3% grow on press fights the 97% shrink
 * .press already applies.
 */
const PRIMARY = "bg-white text-black hover:bg-white/90";
const SECONDARY =
  "bg-[var(--color-surface)] text-white border border-[var(--line-button)] hover:bg-[var(--color-raised)]";

export function Button({
  href,
  variant = "solid",
  size = "md",
  className,
  children,
  target,
  loading,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    "press inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40";
  const variants = {
    solid: PRIMARY,
    outline: SECONDARY,
    ghost: "text-white hover:bg-white/[0.06]",
  };
  // 52px is the spec's button. sm stays smaller for the few places a button
  // sits inline inside a row, where a 52px pill would set the row's height.
  const sizes = {
    sm: "min-h-11 px-5 text-[13px]",
    md: "h-[52px] px-6 text-[15px]",
    lg: "h-[52px] px-8 text-[15px]",
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
    <button className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

/* --- Spinner: inherits the button's text colour, so it reads on any surface -- */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current/30 border-t-current align-[-0.125em]",
        className,
      )}
    />
  );
}

/* --- Eyebrow / utility label ------------------------------------------------ */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string; yellow?: boolean }) {
  // `yellow` is still accepted and still ignored. It was already doing nothing
  // before the palette went monochrome, and several callers still pass it.
  return <div className={cn("util-label", className)}>{children}</div>;
}

/* --- Card: surface, hairline edge, 20px corners ----------------------------- */
export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-[var(--line-card)] bg-[var(--color-surface)] text-white",
        hover && "transition-colors hover:border-white/20",
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
    <header className="pb-5">
      {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* 34px bold, the spec's page title. It was .display at text-4xl, which
            is the condensed face the hero uses -- at page-title size that read
            as a second hero on every screen. */}
        <h1 className="text-[34px] font-bold leading-tight tracking-tight text-white">{title}</h1>
        <div className="flex items-center gap-4 pb-1">
          {count != null && (
            <span className="text-[14px] text-[var(--color-secondary-text)]">{count}</span>
          )}
          {action}
        </div>
      </div>
    </header>
  );
}

/* --- SectionDivider: full-width bar, thin rules, centered label ------------- */
export function SectionDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-8 border-y border-[var(--line-divider)] py-3 text-center">
      <span className="util-label ">{children}</span>
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
        yellow ? "bg-carz " : "bg-card text-card-foreground",
        className,
      )}
    >
      <div className="display text-5xl sm:text-6xl">{value}</div>
      <div className={cn("util-label mt-2", yellow ? "" : "")}>{label}</div>
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
              <th key={i} className="util-label px-3 py-2.5  first:pl-0 last:pr-0 last:text-right">
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
              r.highlight ? "bg-carz " : "",
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
  fallback,
  color,
}: {
  src?: string;
  alt: string;
  className?: string;
  /** Placeholder when there's no photo. Defaults to a car outline. */
  fallback?: ReactNode;
  color?: boolean; // true = show in full color (not black & white)
}) {
  if (!src) {
    return (
      <div className={cn("flex items-center justify-center bg-white/[0.04]", !color && "grayscale", className)}>
        {fallback ?? <Car className="h-9 w-9 opacity-40" strokeWidth={1.5} aria-hidden />}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={cn("img-settle h-full w-full object-cover", color ? "" : "car-photo", className)}
      draggable={false}
    />
  );
}

/* --- Skeleton --------------------------------------------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/[0.06]", className)} />;
}

/* --- LiveDot: the single yellow live indicator ------------------------------ */
export function LiveDot({ className }: { className?: string }) {
  return <span className={cn("carz-live-dot inline-block h-2 w-2 rounded-full bg-white", className)} />;
}

/* --- SearchPill: 52px, surface, with a white go button on the right --------- */
export function SearchPill({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Omit for a field that filters as you type with nothing to submit. */
  onSubmit?: () => void;
  placeholder: string;
  /** Read out instead of the placeholder, which disappears as soon as you type. */
  label: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const field = (
    <>
      <SearchIcon
        className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-muted-text)]"
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        className={cn(
          "h-[52px] w-full rounded-full border border-[var(--line-card)] bg-[var(--color-surface)]",
          "pl-11 text-[15px] text-white outline-none",
          "placeholder:text-[var(--color-muted-text)]",
          // Safari draws its own X inside type=search and it is not ours.
          "[&::-webkit-search-cancel-button]:appearance-none",
          onSubmit ? "pr-14" : "pr-4",
        )}
      />
      {onSubmit && (
        <button
          type="submit"
          aria-label={label}
          className="press absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white"
        >
          <ArrowRight className="h-[18px] w-[18px] text-black" strokeWidth={2.25} aria-hidden />
        </button>
      )}
    </>
  );

  // A form only when there is something to submit, so Enter does not reload a
  // field that filters as you type.
  return onSubmit ? (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cn("relative", className)}
    >
      {field}
    </form>
  ) : (
    <div className={cn("relative", className)}>{field}</div>
  );
}

/* --- StatBox: a bold value over a grey label -------------------------------- */
export function StatBox({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-stat border border-[var(--line-card)] bg-[var(--color-surface)] px-3 py-3.5 text-center">
      <div className="text-[17px] font-bold leading-tight text-white">{value}</div>
      <div className="mt-1 text-[12px] leading-tight text-[var(--color-secondary-text)]">{label}</div>
    </div>
  );
}

/* --- ListRow: icon, label, chevron. The app's one way of listing links ------ */
export function ListRow({
  href,
  onClick,
  icon,
  label,
  meta,
  trailing,
}: {
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
  label: ReactNode;
  /** Secondary text under the label. */
  meta?: ReactNode;
  /** Replaces the chevron — a status word, a count, a bookmark. */
  trailing?: ReactNode;
}) {
  const inner = (
    <>
      {icon && <span className="shrink-0 text-white">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-white">{label}</span>
        {meta && (
          <span className="block truncate text-[14px] text-[var(--color-secondary-text)]">{meta}</span>
        )}
      </span>
      {trailing ?? (
        <ChevronRight
          className="h-[18px] w-[18px] shrink-0 text-[var(--color-muted-text)]"
          strokeWidth={1.75}
          aria-hidden
        />
      )}
    </>
  );
  const cls =
    "press flex min-h-14 w-full items-center gap-3 border-b border-[var(--line-divider)] px-1 py-3 text-left";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* --- TextTabs: evenly spread, white underline on the current one ------------ */
export function TextTabs<T extends string>({
  tabs,
  current,
  onPick,
  label,
}: {
  tabs: readonly { id: T; label: string }[];
  current: T;
  onPick: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex border-b border-[var(--line-divider)]">
      {tabs.map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onPick(t.id)}
            className={cn(
              "press min-h-11 flex-1 pb-3 pt-1 text-[15px] font-semibold transition-colors",
              // -1px so the underline sits on the divider rather than above it.
              active
                ? "-mb-px border-b-2 border-white text-white"
                : "text-[var(--color-secondary-text)]",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

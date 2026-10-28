"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The streak badge, as supplied.
 *
 * Two deliberate departures from the source, both so it can sit on a photo.
 *
 * The secondary text used text-muted-foreground, which is a fixed colour from
 * the palette: correct on a card, wrong over the hero, where it would resolve
 * to near-black in light mode against a dark photo. It inherits the current
 * colour at reduced opacity instead, so the badge reads on whatever it is put
 * on and the caller sets one colour rather than three.
 *
 * The flame keeps text-primary by default but the icon prop overrides it,
 * which is how the hero gives it the key colour over a dark backdrop.
 */

// Types (inlined - only fields used by this component)
interface StreakResponse {
  length: number;
  frequency: "daily" | "weekly" | "monthly";
}

// Variants
const streakBadgeVariants = cva(
  // rounded-card is the app's own radius token, so this is a squircle via the
  // global corner-shape rule and matches every other card. rounded-3xl was a
  // raw Tailwind value, which §9 calls a library default showing through.
  "inline-flex flex-col items-center justify-center rounded-card border border-border/60 bg-card text-center text-card-foreground transition-colors",
  {
    variants: {
      size: {
        sm: "w-28 gap-1.5 p-3",
        default: "w-40 gap-2.5 p-5",
        lg: "w-52 gap-3 p-6",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

// Props
interface StreakBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof streakBadgeVariants> {
  /** Streak length value */
  length?: number;
  /** Streak frequency used for label rendering */
  frequency?: StreakResponse["frequency"];
  /** Optional subtitle shown below streak length */
  subtitle?: string;
  /** Custom icon to replace flame */
  icon?: React.ReactNode;
}

const StreakBadge = React.forwardRef<HTMLDivElement, StreakBadgeProps>(
  ({ className, size, length, frequency = "daily", subtitle, icon, ...props }, ref) => {
    const streakLength = length ?? 0;

    const frequencyLabel = {
      daily: "day",
      weekly: "week",
      monthly: "month",
    }[frequency];

    const pluralLabel = streakLength === 1 ? frequencyLabel : `${frequencyLabel}s`;

    const iconSize = {
      sm: "h-10 w-10",
      default: "h-16 w-16",
      lg: "h-20 w-20",
    }[size ?? "default"];

    const valueSize = {
      sm: "text-2xl",
      default: "text-5xl",
      lg: "text-6xl",
    }[size ?? "default"];

    const subtitleSize = {
      sm: "text-xs",
      default: "text-sm",
      lg: "text-base",
    }[size ?? "default"];

    const subtitleText = subtitle ?? "streak";
    const valueUnit = pluralLabel;

    // Build accessible label
    const ariaLabel = `${streakLength} ${pluralLabel} streak`;

    return (
      <div
        ref={ref}
        role="status"
        aria-label={ariaLabel}
        className={cn(streakBadgeVariants({ size }), className)}
        {...props}
      >
        {icon ?? <Flame className={cn(iconSize, "text-primary shrink-0")} aria-hidden="true" />}
        <span className={cn("font-semibold tracking-tight tabular-nums", valueSize)} aria-hidden="true">
          {streakLength}
          <span className="ml-2 font-medium opacity-60">{valueUnit}</span>
        </span>
        <span className={cn("font-normal opacity-60", subtitleSize)} aria-hidden="true">
          {subtitleText}
        </span>
      </div>
    );
  },
);
StreakBadge.displayName = "StreakBadge";

export { StreakBadge, streakBadgeVariants };
export type { StreakBadgeProps, StreakResponse };

"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The glass capsule button.
 *
 * The look comes from the brief: a conic rim catching light in three arcs, a
 * diagonal specular band across the face, a soft shadow underneath. The
 * material underneath it is the app's own -- `.glass-card` -- rather than a
 * second one brought along with the component, so this button blurs and
 * un-blurs with every other glass surface when `data-glass="lite"` is set on a
 * slow device or the viewer has asked for reduced transparency.
 *
 * Everything that paints is static. See the note over `.gbtn` in globals.css
 * for the three things from the brief that are deliberately not here and why:
 * in short, §1 allows transform and opacity, and the brief animated a conic
 * gradient, a shadow blur and a background position on the one control in an
 * app that gets pressed constantly.
 *
 * Most of the app does not use this directly. `Button` in ui/editorial renders
 * it for its solid and outline variants, so the app's buttons change in one
 * place. This is for the handful of spots that need a button with no `href`
 * handling, a loading spinner or any of the rest of that component's surface.
 */

const shell = cva(
  // `press` is the app's :active scale. §6: a press is scale(.97), not a 25
  // degree rotateX -- the brief tilted the whole capsule in 3D, which on a
  // phone reads as the button falling over.
  "press gbtn glass-card relative inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      size: {
        // §8: large 50, regular 44, small 34 -- and 44 is also the floor for a
        // touch target, so `sm` keeps a 44px minimum and only looks smaller.
        sm: "min-h-11 px-5 text-[15px]",
        md: "h-11 px-6 text-[15px]",
        lg: "h-[50px] px-8 text-[17px]",
        icon: "h-11 w-11",
      },
      tone: {
        plain: "text-foreground",
        /** §2: one per view. */
        tint: "gbtn--tint",
      },
    },
    defaultVariants: { size: "md", tone: "plain" },
  },
);

/**
 * An intersection rather than an interface with an empty body: the shadcn shape
 * this came from is `interface ... extends A, B {}`, and
 * @typescript-eslint/no-empty-object-type is an error in
 * eslint-config-next/typescript, which `next build` runs.
 */
export type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof shell>;

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton({ className, children, size, tone, ...rest }, ref) {
    return (
      <button ref={ref} className={cn(shell({ size, tone }), className)} {...rest}>
        {/* The band. A real element rather than a third pseudo-element, because
            ::before is already the blur layer on .glass-card and ::after is the
            rim. */}
        <span aria-hidden className="gbtn-sheen" />
        <span className="gbtn-label">{children}</span>
      </button>
    );
  },
);

export default GlassButton;

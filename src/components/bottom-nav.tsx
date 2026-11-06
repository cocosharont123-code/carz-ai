"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, ScanLine, Crosshair, User } from "lucide-react";
import { GlassFilter, GlassPane } from "@/components/ui/liquid-glass";
import { cn } from "@/lib/utils";

/**
 * The tab bar: Home, Map, Scan, Hunt, Profile.
 *
 * Docked to the bottom edge on solid black with no border, rather than the
 * floating glass bubble this was. Five fixed destinations and no menu -- what
 * the menu used to hold now lives on Home as tiles and list rows, which is the
 * one place a list of everything the app does belongs.
 *
 * It renders its own spacer rather than the layout applying a global padding
 * rule, so the height and the space kept clear of it cannot drift apart, and a
 * route that hides the bar gets no phantom gap at the bottom. That only works
 * because the layout renders this after the page content.
 */

/** The bar itself, before the home-indicator strip under it. */
const BAR_H = "56px";

/**
 * Where the bar is not drawn: the sign-in wall, and nothing else.
 *
 * Scan came off this list. The same reasoning that kept Map on the bar applies
 * to it and I missed it the first time -- Scan is one of the five tabs, and a
 * tab that hides the bar is a screen you can only leave the one way its own X
 * allows. Switching to Hunt from the scanner meant closing it first.
 *
 * The sign-in flow stays hidden because there is genuinely nothing behind it
 * to tab to.
 */
const FULL_SCREEN = ["/signin"];

const TABS = [
  { href: "/", label: "Home", Icon: Home, match: (p: string) => p === "/" },
  { href: "/map", label: "Map", Icon: Map, match: (p: string) => p.startsWith("/map") },
  { href: "/spot", label: "Scan", Icon: ScanLine, match: (p: string) => p === "/spot", center: true },
  { href: "/hunt", label: "Hunt", Icon: Crosshair, match: (p: string) => p.startsWith("/hunt") },
  { href: "/profile", label: "Profile", Icon: User, match: (p: string) => p.startsWith("/profile") },
] as const;

/**
 * The lamp over the current tab.
 *
 * The brief for this was a "tubelight" bar that slides between items with
 * framer-motion's `layoutId`. The look is here; the mechanism is not, for a
 * reason: a layout animation interpolates left and width, and §1 allows
 * transform and opacity only. One strip the width of a tab, translated by whole
 * multiples of itself, lands in the same places and composites on the GPU.
 *
 * It also sits inside the top edge rather than above it. The bar is welded to
 * the bottom of the screen with its top corners rounded, so a glow drawn above
 * that edge would be clipped by the pane it is meant to be shining out of.
 */
function Tubelight({ index, hidden }: { index: number; hidden: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 w-1/5",
        "transition-[transform,opacity] duration-[350ms] ease-[cubic-bezier(.32,.72,0,1)]",
      )}
      style={{
        transform: `translate3d(${index * 100}%, 0, 0)`,
        opacity: hidden ? 0 : 1,
      }}
    >
      {/* The tube: a hard 3px line on the edge itself. */}
      <span className="absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-carz" />
      {/* And what it throws off, as three static layers rather than an animated
          blur -- §1: blur is never animated, and these only ever move. */}
      <span className="absolute left-1/2 top-0 h-6 w-12 -translate-x-1/2 rounded-full bg-carz/25 blur-md" />
      <span className="absolute left-1/2 top-0 h-5 w-8 -translate-x-1/2 rounded-full bg-carz/25 blur-md" />
      <span className="absolute left-1/2 top-0 h-4 w-4 -translate-x-1/2 rounded-full bg-carz/20 blur-sm" />
    </span>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  if (FULL_SCREEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  /**
   * Which tab is lit, and whether to light one at all.
   *
   * -1 on a route that is not a tab -- /settings, /garage, /leaderboard -- and
   * the lamp fades out rather than parking on Home, which would claim you are
   * somewhere you are not. Scan is skipped too: its raised circle is already
   * its own indicator, and a second one under it reads as two selections.
   */
  const activeIndex = TABS.findIndex((t) => t.match(pathname));
  const lampIndex = activeIndex < 0 ? 0 : activeIndex;
  const lampHidden = activeIndex < 0 || !!(TABS[activeIndex] as { center?: boolean }).center;

  return (
    <>
      {/* Defines #glass-distortion for the pane below. Mounted here because the
          nav is the one component on every page that uses it. */}
      <GlassFilter />

      <nav
        aria-label="Main"
        // §4: absolute inside #app rather than fixed to the window, so it
        // belongs to the shell and cannot drift when the visual viewport
        // changes. main's padding-bottom keeps content clear of it -- there is
        // no spacer element any more.
        className="absolute inset-x-0 bottom-0 z-[60] flex justify-center"
      >
        {/* Welded to the bottom edge, not floating above it.

            It floated before: side margins, and the home-indicator strip as
            padding underneath. That is what kept leaving it sitting up off the
            bottom of the phone. The strip still cannot be built on -- it is
            where the system draws the indicator and a tab stacked under it
            cannot be tapped -- so the glass extends through it while the tabs
            stop above it. That is how the native tab bar does it, and it is
            the only way to be on the bottom edge and still tappable.

            Asked for three times, so the tabs go on the edge too, not just
            the glass behind them: there is no safe-area reservation left here
            at all. The trade is real and deliberate -- on a phone with a home
            indicator the system draws that bar across the bottom of the
            labels. Taps still register there; it is only the edge swipe that
            iOS keeps for itself.

            Top corners only -- a radius on the bottom two would show the page
            through the corners of a bar that is flush. */}
        <GlassPane
          className="relative flex w-full items-stretch rounded-t-[28px] rounded-b-none"
          style={{ height: BAR_H }}
        >
          <Tubelight index={lampIndex} hidden={lampHidden} />

          {TABS.map(({ href, label, Icon, match, ...rest }) => {
            const active = match(pathname);
            const center = "center" in rest && rest.center;

            if (center) {
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className="group relative flex flex-1 items-center justify-center"
                >
                  {/* 64px, lifted clear of the row. Black inside a white ring
                      rather than a filled white disc: filled, it is the
                      brightest object on a black screen and pulls the eye off
                      whatever the page is actually showing. */}
                  <span
                    className={cn(
                      "press absolute -top-3 flex h-16 w-16 items-center justify-center rounded-full",
                      "border-2 border-foreground bg-background shadow-[var(--glow)]",
                    )}
                  >
                    <ScanLine className="h-7 w-7 text-foreground" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="sr-only">{label}</span>
                </Link>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="press flex min-h-11 flex-1 flex-col items-center justify-center gap-1"
              >
                <Icon
                  className={cn("h-6 w-6", active ? "text-foreground" : "text-[var(--color-muted-text)]")}
                  strokeWidth={1.75}
                  // Filled when current. Not colour alone: the label changes
                  // weight and shade with it.
                  fill={active ? "currentColor" : "none"}
                  aria-hidden
                />
                <span
                  className={cn(
                    // 11px, per the spec. A blanket captions sweep had taken this to 12.
                    "text-[11px] leading-none",
                    active ? "font-semibold text-foreground" : "text-[var(--color-muted-text)]",
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </GlassPane>
      </nav>

    </>
  );
}

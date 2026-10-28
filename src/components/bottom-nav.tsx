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

export function BottomNav() {
  const pathname = usePathname();

  if (FULL_SCREEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

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
          className="flex w-full items-stretch rounded-t-[28px] rounded-b-none"
          style={{ height: BAR_H }}
        >
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

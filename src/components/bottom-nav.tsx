"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, ScanLine, Crosshair, User } from "lucide-react";
import { GlassFilter, GlassPane } from "@/components/ui/liquid-glass";
import { cn } from "@/lib/utils";

/**
 * The tab bar: Home, Map, Scan, Hunt, Profile.
 *
 * Flush with the bottom edge of the screen -- full width of the 480px column,
 * no air underneath, no side gutters. Five fixed destinations and no menu -- what
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
        className="fixed inset-x-0 bottom-0 z-[60] flex justify-center"
      >
        {/* Welded to the bottom edge, not floating above it.
        
            It was a dock: 10px of air under it, 12px either side, and a 28px
            radius all the way round -- so on a phone the glass stopped about
            44px short of the bottom of the screen and black showed underneath.
            Now the pane runs to the physical edge and the full width of the
            column, and the home-indicator strip is padding *inside* it instead
            of a gap below it, so the icons still clear the indicator while the
            material reaches the end of the screen.
        
            The radius is top-only for the same reason: the bottom corners are
            off-screen, and rounding them cut two notches out of the material at
            the one place it is meant to be continuous with the edge. */}
        <GlassPane
          className="flex w-full max-w-[480px] items-stretch rounded-t-[28px]"
          style={{
            height: `calc(${BAR_H} + env(safe-area-inset-bottom, 0px))`,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
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

      {/* Holds the page clear of the bar by exactly its height -- the bar's
          own height now includes the home-indicator strip, and the 20px that
          used to be added here was the air under the floating dock. shrink-0
          because this is a flex item in the layout's column and a spacer that
          can be squashed is not a spacer. */}
      <div
        aria-hidden
        className="shrink-0"
        style={{ height: `calc(${BAR_H} + env(safe-area-inset-bottom, 0px))` }}
      />
    </>
  );
}

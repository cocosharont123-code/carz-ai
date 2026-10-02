"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, ScanLine, Crosshair, User } from "lucide-react";
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
 * Where the bar is not drawn.
 *
 * The scanner owns the whole viewport and has its own X to leave by, and the
 * sign-in flow is a wall with nothing behind it to tab to.
 *
 * Map is deliberately not on this list even though it is full-bleed: it is one
 * of the five tabs, and a tab that hides the bar is a screen you cannot leave.
 * The map sits above the bar instead.
 */
const FULL_SCREEN = ["/spot", "/signin"];

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
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-[60] bg-background"
        // The home-indicator strip, so the row sits above it rather than under
        // it. The layout keeps every page one pixel taller than the viewport,
        // which settles Safari's bottom toolbar before first paint -- without
        // that this inset changes from 0 to ~34px the moment a page becomes
        // scrollable, and a bar measured from it jumps.
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-[480px] items-stretch" style={{ height: BAR_H }}>
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
                    "text-[12px] leading-none",
                    active ? "font-semibold text-foreground" : "text-[var(--color-muted-text)]",
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Holds the page clear of the bar by exactly its height plus the strip
          under it. shrink-0 because this is a flex item in the layout's column
          and a spacer that can be squashed is not a spacer. */}
      <div
        aria-hidden
        className="shrink-0"
        style={{ height: `calc(${BAR_H} + env(safe-area-inset-bottom, 0px))` }}
      />
    </>
  );
}

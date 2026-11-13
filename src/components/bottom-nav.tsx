"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, ScanLine, Crosshair, User } from "lucide-react";
import { GlassFilter, GlassPane } from "@/components/ui/liquid-glass";
import { cn } from "@/lib/utils";

/**
 * The tab bar: Home, Map, Scan, Hunt, Profile.
 *
 * A capsule on the bottom edge of the screen: inset 16px either side, rounded
 * all the way round, with its bottom curve against the edge. Five fixed destinations and
 * no menu -- what the menu used to hold now lives on Home as tiles and list
 * rows, which is the one place a list of everything the app does belongs.
 *
 * It renders no spacer: #app:has(nav[aria-label="Main"]) main in globals.css
 * reserves --nav-h + 12px, and --nav-h is the pill plus the gap under it, so
 * the height and the space kept clear of it cannot drift apart.
 */

/** The pill itself. The gap under it lives in --nav-gap. */
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
 * The pill behind the current tab.
 *
 * This was a tubelight: a 3px bar on the top edge with three blurred layers
 * glowing off it. That belonged to a bar welded to the bottom of the screen,
 * where the edge was a straight line and the glow had a flat surface to shine
 * along. On a capsule it was wrong twice over -- the bar lay across a curve,
 * and the glow, which reaches 24px down, washed out the icon and the first
 * letter of the label underneath it. "Home" read as "ome".
 *
 * So it is the thing §8 actually specifies: a selected pill that slides. One
 * strip the width of a tab, translated by whole multiples of itself -- §1
 * allows transform and opacity, and a layout animation that interpolates left
 * and width does neither. It composites on the GPU and lands in the same
 * places a layoutId animation would.
 */
function Tubelight({ index, hidden }: { index: number; hidden: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 flex w-1/5 items-center justify-center",
        "transition-[transform,opacity] duration-[350ms] ease-[cubic-bezier(.32,.72,0,1)]",
      )}
      style={{
        transform: `translate3d(${index * 100}%, 0, 0)`,
        opacity: hidden ? 0 : 1,
      }}
    >
      {/* Inset 6px so the pill is concentric with the capsule around it (§3)
          and clears its rim. A tint of the foreground rather than a fill: it
          sits under a white icon and a white label, and anything stronger
          turns the pair into a silhouette. */}
      <span className="h-[44px] w-[calc(100%-6px)] rounded-full bg-foreground/[0.10]" />
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
        className="absolute inset-x-0 bottom-0 z-[60] flex justify-center px-4"
        style={{ paddingBottom: "var(--nav-gap)" }}
      >
        {/* A capsule, on the edge. Both halves of a request made twice.

            The history explains the shape, because the two asks pull against
            each other. It was a floating dock; that read as sitting up off the
            bottom of the phone, so it became a full-width bar welded to the
            edge with its bottom corners squared off; then the shape was the
            complaint, because a flat-bottomed slab across the screen is not
            what a tab bar looks like. So: the pill, on the bottom edge.

            Rounded the whole way round -- §3 gives .rounded-full
            `corner-shape: round`, because a capsule is not a squircle -- inset
            16px either side, and no gap underneath, so the bottom curve meets
            the edge of the screen. It overlaps the home-indicator strip
            deliberately, exactly as the flush bar did: taps register there,
            and only the edge swipe belongs to iOS.

            The shadow stays. Against the edge there is less for it to fall on,
            but it is still what separates the pill's lower curve from whatever
            scrolls past behind it. */}
        <GlassPane
          className="relative flex w-full items-stretch rounded-full shadow-[var(--glass-shadow)]"
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

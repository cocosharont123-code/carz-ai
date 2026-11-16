"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Map, ScanLine, Crosshair, User } from "lucide-react";
import { GlassFilter, GlassPane } from "@/components/ui/liquid-glass";
import { cn } from "@/lib/utils";

/**
 * The tab bar: Home, Map, Scan, Hunt, Profile.
 *
 * A capsule on the bottom edge of the screen: inset 16px either side, rounded
 * all the way round, with its bottom curve against the edge. The glass reaches
 * the edge; the tabs stop above the home-indicator strip, which is the
 * system's and not ours to put a target on. Five fixed destinations and
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
  {
    href: "/map",
    label: "Map",
    Icon: Map,
    match: (p: string) => p.startsWith("/map"),
  },
  {
    href: "/spot",
    label: "Scan",
    Icon: ScanLine,
    match: (p: string) => p === "/spot",
    center: true,
  },
  {
    href: "/hunt",
    label: "Hunt",
    Icon: Crosshair,
    match: (p: string) => p.startsWith("/hunt"),
  },
  {
    href: "/profile",
    label: "Profile",
    Icon: User,
    match: (p: string) => p.startsWith("/profile"),
  },
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
function Tubelight({
  index,
  hidden,
  dragging,
}: {
  index: number;
  hidden: boolean;
  /** Shorter glide while a finger is driving it -- 350ms reads as lag. */
  dragging: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 flex w-1/5 items-center justify-center",
        "transition-[transform,opacity] ease-[cubic-bezier(.32,.72,0,1)]",
        dragging ? "duration-[120ms]" : "duration-[350ms]",
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

  // Above the early return, because hooks cannot be called conditionally and
  // this component bails out on the sign-in flow. The drag state they hold is
  // described where it is used, below.
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const startIndex = useRef<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  if (FULL_SCREEN.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return null;

  /**
   * Which tab is lit, and whether to light one at all.
   *
   * -1 on a route that is not a tab -- /settings, /garage, /leaderboard -- and
   * the lamp fades out rather than parking on Home, which would claim you are
   * somewhere you are not. Scan is skipped too: its raised circle is already
   * its own indicator, and a second one under it reads as two selections.
   */
  const activeIndex = TABS.findIndex((t) => t.match(pathname));

  /**
   * Drag a finger across the bar to pick a tab.
   *
   * The pill follows the finger and the tab under it lights up; letting go
   * goes there. It is the iOS gesture for a row of segments: you can correct
   * your aim without lifting, which on a 72px-wide target at the bottom edge
   * of a phone is the difference between landing on Map and landing on Scan.
   *
   * Pointer events, not touch events, so a trackpad drag behaves the same.
   * The pointer is captured on the bar, so a finger that slides off the end --
   * or below the screen edge, which is most of a thumb's travel down here --
   * keeps reporting to it instead of being lost to whatever is underneath.
   *
   * A tap is left alone. Nothing navigates on pointerup unless the finger
   * actually moved to a different tab; a plain tap falls through to the
   * <Link>, which is still a real link with a real href for the keyboard, the
   * screen reader and a long-press "open in new tab".
   */

  function indexAt(clientX: number): number {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const slot = rect.width / TABS.length;
    const raw = Math.floor((clientX - rect.left) / slot);
    return Math.max(0, Math.min(TABS.length - 1, raw));
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Primary input only: a right-click or a second finger mid-drag should not
    // take over the gesture.
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const i = indexAt(e.clientX);
    startIndex.current = i;
    setDragIndex(i);
    /**
     * No setPointerCapture, and that was the bug.
     *
     * Capturing retargets every later pointer event *and the click the
     * browser synthesises from them* to the capturing element. The capturing
     * element here is this wrapper, not the <a> under the finger -- so the
     * click never reached a link and tapping a tab stopped navigating at all.
     * The drag went with it, because the gesture's own pointerup was being
     * delivered somewhere this code was not reading it.
     *
     * It is not needed either: a touch pointer is implicitly captured to the
     * element that received pointerdown, and these handlers are on that
     * element's ancestor, so the moves bubble here regardless. A mouse drag
     * stays over the bar, which is the whole gesture.
     */
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (startIndex.current === null) return;
    const i = indexAt(e.clientX);
    setDragIndex((prev) => (prev === i ? prev : i));
  }

  /**
   * Releasing navigates -- a tap and a drag alike.
   *
   * It used to leave a tap to the link's own click and only handle the drag
   * itself, which meant the bar worked in two different ways depending on
   * how far a finger moved, and worked at all only if the click arrived.
   * Doing it here makes both the same gesture: wherever the finger is when
   * it lifts is where you go.
   *
   * preventDefault stops the compatibility click that would otherwise follow
   * and navigate a second time. The links keep their href -- they are still
   * real links for the keyboard, for a screen reader, and for long-press.
   */
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const from = startIndex.current;
    const to = dragIndex;
    startIndex.current = null;
    setDragIndex(null);
    if (from === null || to === null) return;

    // Lifted away from the bar: a cancelled gesture, the way sliding off a
    // button cancels it everywhere else.
    const rect = barRef.current?.getBoundingClientRect();
    if (rect) {
      const slack = 44; // a thumb's worth, so a slightly low release still counts
      if (
        e.clientY < rect.top - slack ||
        e.clientY > rect.bottom + slack ||
        e.clientX < rect.left - slack ||
        e.clientX > rect.right + slack
      ) {
        return;
      }
    }

    e.preventDefault();
    router.push(TABS[to].href);
  }

  function onPointerCancel() {
    startIndex.current = null;
    setDragIndex(null);
  }

  const dragging = dragIndex !== null;
  const shownIndex = dragIndex ?? activeIndex;
  const lampIndex = shownIndex < 0 ? 0 : shownIndex;
  // Hidden on a route that is not a tab, and on Scan, whose raised circle is
  // already its own indicator -- but never while dragging: during a drag the
  // pill is the thing saying where your finger is, including over Scan.
  const lampHidden =
    !dragging &&
    (activeIndex < 0 || !!(TABS[activeIndex] as { center?: boolean }).center);

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
        {/* The drag surface wraps the pane rather than being it: GlassPane
            takes a class and a style and nothing else, and threading a dozen
            pointer handlers through it would make every other caller carry
            them. touch-none because this is not a scroll surface -- without it
            the browser claims the gesture as a page pan and the pill stutters
            behind the finger. */}
        <div
          ref={barRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          // A link is draggable by default, so pressing one and moving starts
          // a native link-drag -- which fires pointercancel and killed this
          // gesture on its first millimetre. Every tab is a link, so every
          // drag started on one. The links below also carry draggable={false};
          // this is the backstop for anything else that lands in here.
          onDragStart={(e) => e.preventDefault()}
          className="w-full max-w-[480px] touch-none select-none"
        >
          <GlassPane
            className="relative flex w-full items-stretch rounded-full shadow-[var(--glass-shadow)]"
            // The glass runs to the bottom of the screen; the tabs stop above
            // the home-indicator strip.
            //
            // They were on the strip itself, which is where iOS draws the
            // indicator and where Safari parks its own toolbar -- so on a real
            // phone a tap could land on the system's furniture rather than on
            // a tab, and the bar stopped switching pages. Making the pane
            // taller by the inset and padding the same amount off its bottom
            // keeps the capsule visually on the edge, which is what was asked
            // for, while every target sits above the part of the screen the
            // system has already claimed.
            style={{
              height: `calc(${BAR_H} + env(safe-area-inset-bottom, 0px))`,
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            <Tubelight
              index={lampIndex}
              hidden={lampHidden}
              dragging={dragging}
            />

            {TABS.map(({ href, label, Icon, match, ...rest }) => {
              const active = match(pathname);
              const center = "center" in rest && rest.center;

              if (center) {
                return (
                  <Link
                    key={href}
                    href={href}
                    draggable={false}
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
                      <ScanLine
                        className="h-7 w-7 text-foreground"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </span>
                    <span className="sr-only">{label}</span>
                  </Link>
                );
              }

              return (
                <Link
                  key={href}
                  href={href}
                  draggable={false}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className="press flex min-h-11 flex-1 flex-col items-center justify-center gap-1"
                >
                  <Icon
                    className={cn(
                      "h-6 w-6",
                      active
                        ? "text-foreground"
                        : "text-[var(--color-muted-text)]",
                    )}
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
                      active
                        ? "font-semibold text-foreground"
                        : "text-[var(--color-muted-text)]",
                    )}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </GlassPane>
        </div>
      </nav>
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Home,
  Trophy,
  ScanLine,
  Play,
  Warehouse,
  Menu,
  X,
  User,
  Settings,
  LogIn,
  LogOut,
  ShieldCheck,
  Lock,
  ChevronDown,
  Crown,
  Crosshair,
} from "lucide-react";
import { EXPLORE_BUBBLES, EXPLORE_COPY } from "@/config/explore";
import { GlassFilter } from "@/components/ui/liquid-glass";
import { cn } from "@/lib/utils";

/**
 * The nav: a glass bubble floating at the bottom of the screen, carrying five
 * icon targets plus the menu. Same targets, same order, same menu as always.
 *
 * It renders its own spacer rather than the root layout adding a global padding
 * rule, so the height and the offset can never drift apart — and a route that
 * hides the nav gets no phantom gap. The spacer only works if this is rendered
 * after the page content, which is why the layout puts it there.
 */

// All from globals.css, so the bubble's own offset, the space pages keep clear
// and the sheet that opens off it cannot disagree about where the nav is.
const BAR_H = "h-14";
const SPACER_H = { height: "var(--nav-h)" } as const;
// One constant, no env(). See the note on --nav-gap: the bottom inset changes
// under you on iOS, and a bubble positioned from it moves when it does.
const BUBBLE_OFFSET = { bottom: "var(--nav-gap)" } as const;

export function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  // Held open past the close so the sheet can animate out. A panel that fades
  // in and then vanishes on the way back reads as half-finished.
  const [menuClosing, setMenuClosing] = useState(false);
  /*
   * No visualViewport pinning here, deliberately.
   *
   * There was: the bubble was translated every frame by the gap between the
   * layout and visual viewports, to stop it drifting on scroll. The drift it
   * was written for turned out to be a CSS cascade bug — .glass-bubble
   * declared position:relative unlayered and beat Tailwind's own .fixed, so
   * the nav was never fixed at all. With that fixed, position:fixed holds the
   * bubble on its own.
   *
   * Leaving the correction in made things worse rather than redundant. iOS
   * already lifts fixed elements off an open keyboard, so the translate
   * doubled it and the bubble climbed the screen on CarzBot; and recomputing a
   * transform on every scroll and viewport event is work on a component that
   * is on every page, which is the lag.
   */

  const closeMenu = useCallback(() => {
    setMenuOpen((open) => {
      if (open) setMenuClosing(true);
      return false;
    });
  }, []);

  // Unmount once the exit animation has played. Matches .nav-sheet-out.
  useEffect(() => {
    if (!menuClosing) return;
    const t = window.setTimeout(() => setMenuClosing(false), 200);
    return () => window.clearTimeout(t);
  }, [menuClosing]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  // Seven targets with Spot in the middle of them — three either side, so its
  // position is the centre rather than nearly the centre. It is what the app is
  // for; the rest are places to look at what it produced.
  const items = [
    {
      key: "home",
      label: "Home",
      href: "/",
      Icon: Home,
      active: pathname === "/",
    },
    {
      key: "hunt",
      label: "Hunt",
      href: "/hunt",
      Icon: Crosshair,
      active: pathname.startsWith("/hunt"),
    },
    {
      key: "feed",
      label: "Feed",
      href: "/feed",
      Icon: Play,
      active: pathname.startsWith("/feed"),
    },
    {
      key: "spot",
      label: "Spot a car",
      href: "/spot",
      Icon: ScanLine,
      active: pathname === "/spot",
    },
    {
      key: "garage",
      label: "Garage",
      href: "/garage",
      Icon: Warehouse,
      active: pathname.startsWith("/garage"),
    },
    {
      key: "leaderboard",
      label: "Leaderboard",
      href: "/leaderboard",
      Icon: Trophy,
      active: pathname === "/leaderboard",
    },
  ];

  // The lens sits under whichever target is current. Its width is a fraction of
  // the row taken from the target count, so moving it is one transform and
  // nothing has to be measured while it travels. The menu is the last target.
  const targetCount = items.length + 1;
  const spotIndex = items.findIndex((i) => i.key === "spot");
  const rawActive = menuOpen ? items.length : items.findIndex((i) => i.active);
  // The lens skips Spot: its own disc already says it is current, and two
  // markers on one target reads as a mistake rather than as emphasis.
  const activeIndex = rawActive === spotIndex ? -1 : rawActive;

  return (
    <>
      {/* Defines #glass-distortion for the bubble's backdrop. Mounted here
          because the nav is the one component on every page. */}
      <GlassFilter scale={26} />

      <nav
        style={BUBBLE_OFFSET}
        className="glass-bubble fixed left-1/2 z-[60] -ml-[min(13rem,calc(50vw-0.75rem))] w-[min(26rem,calc(100vw-1.5rem))] rounded-full px-1"
        aria-label="Main"
      >
        <div className={cn("relative flex items-stretch justify-around", BAR_H)}>
          {/* The travelling highlight. Hidden rather than removed when nothing
              is current, so it fades instead of snapping back from an edge. */}
          <span
            aria-hidden
            className="nav-lens pointer-events-none absolute inset-y-1.5 left-0 rounded-full"
            style={{
              width: `calc(100% / ${targetCount})`,
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
              opacity: activeIndex < 0 ? 0 : 1,
            }}
          />
          {items.map(({ key, label, href, Icon, active }) => (
            <Link
              key={key}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={closeMenu}
              className="press group relative flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-full"
            >
              {/* Spot's disc. Filled, bigger than the icons either side of it,
                  and lit — it is the one thing on this bar that makes something
                  rather than showing something.
                  
                  Behind the icon and sized to the icon, not to the target, so
                  the 44pt tap area is exactly what it was. */}
              {key === "spot" && (
                <span
                  aria-hidden
                  className={cn(
                    // 44px, not 48: seven targets across a 351px bubble is 49px
                    // each on a small phone, and a 48px disc inside that leaves
                    // a single pixel either side. This still reads as the
                    // largest thing on the bar without touching its neighbours.
                    "pointer-events-none absolute h-11 w-11 rounded-full bg-carz",
                    "shadow-[0_0_18px_-2px_rgba(0,229,255,0.75)]",
                    "transition-transform duration-200 group-active:scale-95",
                  )}
                />
              )}
              <Icon
                size={key === "spot" ? 26 : 24}
                strokeWidth={key === "spot" ? 2.5 : active ? 2.25 : 2}
                className={cn(
                  "relative transition-[opacity,transform] duration-300",
                  key === "spot"
                    // Black on the filled disc: white on this cyan is the one
                    // pairing here that would not clear AA.
                    ? "text-black opacity-100"
                    : active
                      ? "-translate-y-px text-white opacity-100 drop-shadow-[0_1px_6px_rgba(255,255,255,0.35)]"
                      : "text-white opacity-60 group-hover:opacity-90",
                )}
                aria-hidden
              />
            </Link>
          ))}

          <button
            type="button"
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="press group relative flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded-full"
          >
            {menuOpen ? (
              <X
                size={24}
                strokeWidth={2.25}
                className="relative -translate-y-px text-white drop-shadow-[0_1px_6px_rgba(255,255,255,0.35)]"
                aria-hidden
              />
            ) : (
              <Menu
                size={24}
                strokeWidth={2}
                className="relative text-white opacity-60 transition-opacity duration-300 group-hover:opacity-90"
                aria-hidden
              />
            )}
          </button>

        </div>
      </nav>

      {(menuOpen || menuClosing) && (
        <ExploreSheet onClose={closeMenu} closing={!menuOpen} />
      )}

      {/* Holds the page clear of the bar by exactly its height. shrink-0
          because this is a flex item in the layout's column and a spacer that
          can be squashed is not a spacer. */}
      <div style={SPACER_H} className="shrink-0" aria-hidden />
    </>
  );
}

/**
 * The hamburger's sheet: the Explore hub, floating above the bubble.
 *
 * It renders the same config the /explore page does, so there is one list of
 * what this app can do rather than two that drift.
 */
function ExploreSheet({ onClose, closing }: { onClose: () => void; closing: boolean }) {
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className={cn(
          "fixed inset-0 z-[55] bg-black/25",
          closing ? "nav-veil-out" : "nav-veil-in",
        )}
        style={{ bottom: "var(--nav-h)" }}
      />
      <div
        role="dialog"
        aria-label="Explore"
        className={cn(
          "fixed left-1/2 z-[58] -ml-[min(13rem,calc(50vw-0.75rem))] max-h-[70dvh] w-[min(26rem,calc(100vw-1.5rem))]",
          "overflow-y-auto rounded-[28px] border border-white/12 bg-black/55 px-4 pb-4 pt-4 backdrop-blur-2xl",
          "shadow-[0_24px_60px_-18px_rgba(0,0,0,0.9)]",
          closing ? "nav-sheet-out" : "nav-sheet-in",
        )}
        style={{ bottom: "calc(var(--nav-h) + 0.25rem)" }}
      >
        {/* auto-rows-fr so every row is the same height. Without it a label
            that wraps to two lines — "Events & Drops", "Leaderboard" at narrow
            widths — makes its whole row taller than the others. */}
        <div className="grid auto-rows-fr grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
          {EXPLORE_BUBBLES.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "press glass-card relative flex min-h-[44px] items-center gap-3 rounded-2xl px-3 py-3",
                  // Eight rows divide evenly in two columns on their own, so
                  // the last only needs to stretch at three, where seven
                  // preceding rows leave a gap beside it.
                  item.href === "/pricing" && "sm:col-span-2",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">
                  {item.label}
                </span>
                {/* A crown rather than the tier's name. "Carz MAX" spelled out
                    took a third of the tile and pushed the labels into a second
                    line; the mark says the same thing — this one is paid — and
                    the tier itself is on the page you land on. Titled, not just
                    coloured, so it is not colour alone carrying the meaning. */}
                {item.tier && (
                  <Crown
                    className="h-4 w-4 shrink-0 text-carz"
                    strokeWidth={2}
                    aria-label={`${EXPLORE_COPY.tierBadge[item.tier]} feature`}
                  />
                )}
              </Link>
            );
          })}
        </div>

        <AccountRow onClose={onClose} />
      </div>
    </>
  );
}

/**
 * Sign-in, the account and the terms.
 *
 * These lived in the site header, which no longer exists — and signing in is
 * not optional furniture: membership, bidding and posting all need it. So the
 * menu carries them, small, under the features.
 */
function AccountRow({ onClose }: { onClose: () => void }) {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // Same hold-past-close the Explore sheet uses, so the rows animate away
  // rather than blinking out.
  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(() => setClosing(false), 200);
    return () => window.clearTimeout(t);
  }, [closing]);

  function toggle() {
    setOpen((was) => {
      if (was) setClosing(true);
      return !was;
    });
  }

  const links = [
    ...(signedIn
      ? [
          { label: "Account", href: "/profile", Icon: User },
          { label: "Settings", href: "/settings", Icon: Settings },
        ]
      : [{ label: "Sign in", href: "/signin", Icon: LogIn }]),
    { label: "Terms", href: "/terms", Icon: ShieldCheck },
    { label: "Privacy", href: "/privacy", Icon: Lock },
  ];

  return (
    <div className="mt-3">
      {/* One button instead of a rule with five small links strung under it.
          The chevron turns rather than swapping icon, so it reads as the same
          control in two states. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="nav-more"
        className="press glass-card group flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition hover:bg-white/[0.08]"
      >
        More
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-300",
            open && "rotate-180",
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>

      {(open || closing) && (
        <div
          id="nav-more"
          className={cn(
            "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3",
            closing ? "nav-sheet-out" : "nav-sheet-in",
          )}
        >
          {links.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={href}
              onClick={onClose}
              className="press glass-card flex min-h-[44px] items-center gap-3 rounded-2xl px-3 py-3"
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">
                {label}
              </span>
            </Link>
          ))}
          {signedIn && (
            <button
              type="button"
              onClick={() => {
                onClose();
                void signOut();
              }}
              className="press glass-card flex min-h-[44px] items-center gap-3 rounded-2xl px-3 py-3 text-left"
            >
              <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
              <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">
                Sign out
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

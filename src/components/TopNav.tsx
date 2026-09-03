"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine, Play, Warehouse, KeyRound, Menu, X } from "lucide-react";
import { EXPLORE_BUBBLES, EXPLORE_COPY } from "@/config/explore";
import { cn } from "@/lib/utils";

/**
 * The fixed top bar: five icon targets, no labels, on every page.
 *
 * It renders its own spacer rather than the root layout adding a global
 * padding rule, so the height and the offset can never drift apart — and a
 * route that hides the bar gets no phantom gap.
 */

// 56px of bar, plus whatever the notch takes. Both the bar and the spacer are
// sized from these, which is what keeps them in step.
const BAR_H = "h-14";
const SAFE_TOP = { paddingTop: "env(safe-area-inset-top)" } as const;
const SPACER_H = { height: "calc(3.5rem + env(safe-area-inset-top))" } as const;

/**
 * Routes that own the whole screen.
 *
 * /feed is the full-screen reel scroller: it sizes itself to 100dvh and
 * snap-scrolls, so a fixed bar over it would cover the first clip and the
 * spacer would push the scroller past the bottom of the window.
 *
 * The spec also asked for the Miami Rush game route. There is no such route in
 * this repo — nothing under src/app matches, and nothing references it — so
 * there is nothing to match on yet. When that page lands, its prefix goes here.
 */
const FULL_SCREEN_ROUTES = ["/feed"];

export function TopNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (FULL_SCREEN_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const items = [
    {
      key: "spot",
      label: "Spot a car",
      href: "/spot",
      Icon: ScanLine,
      active: pathname === "/spot",
    },
    {
      key: "feed",
      label: "Feed",
      href: "/feed",
      Icon: Play,
      // Never actually renders active: the bar is hidden on /feed itself, since
      // that page is the full-screen scroller. Kept correct anyway.
      active: pathname.startsWith("/feed"),
    },
    {
      key: "garage",
      label: "Garage and ranks",
      href: "/garage",
      Icon: Warehouse,
      // Ranks lives at /leaderboard as a tab on the same group, so the door
      // stays lit when you switch to it.
      active: pathname.startsWith("/garage") || pathname === "/leaderboard",
    },
    {
      key: "sell",
      label: "Sell a car",
      href: "/auctions/new",
      Icon: KeyRound,
      active: pathname === "/auctions/new",
    },
  ];

  const menuActive = menuOpen || pathname === "/explore";

  return (
    <>
      <header
        style={SAFE_TOP}
        className={cn(
          "fixed inset-x-0 top-0 z-[60] bg-black/95 backdrop-blur-xl",
          "border-b border-white/10",
        )}
      >
        <nav className={cn("flex items-stretch justify-around", BAR_H)} aria-label="Main">
          {items.map(({ key, label, href, Icon, active }) => (
            <Link
              key={key}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
              className="press relative flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center"
            >
              <ActiveBar on={active} />
              <Icon
                size={26}
                strokeWidth={2}
                className={cn("text-white transition-opacity", active ? "opacity-100" : "opacity-70")}
                aria-hidden
              />
            </Link>
          ))}

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="press relative flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center"
          >
            <ActiveBar on={menuActive} />
            {menuOpen ? (
              <X size={26} strokeWidth={2} className="text-white" aria-hidden />
            ) : (
              <Menu
                size={26}
                strokeWidth={2}
                className={cn("text-white transition-opacity", menuActive ? "opacity-100" : "opacity-70")}
                aria-hidden
              />
            )}
          </button>

        </nav>
      </header>

      {menuOpen && <ExploreSheet onClose={() => setMenuOpen(false)} />}

      {/* Holds the page down by exactly the bar's height. */}
      <div style={SPACER_H} aria-hidden />
    </>
  );
}

/** The tab indicator: a short bar on the very top edge of the active target. */
function ActiveBar({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span
      aria-hidden
      className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-full bg-white"
    />
  );
}

/**
 * The hamburger's sheet: the Explore hub, slid down under the bar.
 *
 * It renders the same config the /explore page does, so there is one list of
 * what this app can do rather than two that drift.
 */
function ExploreSheet({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-[55] bg-black/60"
        style={{ top: "calc(3.5rem + env(safe-area-inset-top))" }}
      />
      <div
        role="dialog"
        aria-label="Explore"
        className="fixed inset-x-0 z-[58] max-h-[70dvh] overflow-y-auto border-b border-white/10 bg-black/95 px-5 pb-6 pt-5 backdrop-blur-xl"
        style={{ top: "calc(3.5rem + env(safe-area-inset-top))" }}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
          {EXPLORE_BUBBLES.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className="press glass-card relative flex min-h-[44px] items-center gap-3 rounded-2xl px-3 py-3"
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight">
                  {item.label}
                </span>
                {item.membersOnly && (
                  <span className="util-label shrink-0 text-[9px] text-carz">
                    {EXPLORE_COPY.membersBadge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

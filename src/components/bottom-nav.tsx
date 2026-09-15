"use client";

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { EXPLORE_BUBBLES, EXPLORE_COPY } from "@/config/explore";
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
const BUBBLE_OFFSET = {
  bottom: "calc(var(--nav-gap) + env(safe-area-inset-bottom))",
} as const;

export function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const bubbleRef = useRef<HTMLElement>(null);

  /**
   * Hold the bubble still while the page scrolls.
   *
   * position:fixed alone is not enough on iOS. Fixed elements are placed
   * against the layout viewport, and Safari grows and shrinks that as the URL
   * bar collapses and returns — so a bubble pinned to the bottom visibly slides
   * during a scroll even though nothing in the page moved.
   *
   * visualViewport reports what is actually on screen. The gap between the two
   * viewports is exactly how far the bubble has drifted, so pushing it back by
   * that much leaves it where it was put.
   *
   * Written straight to the element, once per frame at most, and never through
   * state: this fires continuously while scrolling, and a re-render per event
   * would make every page stutter.
   */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // Plain position:fixed is already correct without it.
    let frame = 0;
    const apply = () => {
      frame = 0;
      const el = bubbleRef.current;
      if (!el) return;
      const drift = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      el.style.transform = drift ? `translateY(-${drift}px)` : "";
    };
    const onChange = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    window.addEventListener("scroll", onChange, { passive: true });
    apply();
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
      window.removeEventListener("scroll", onChange);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const items = [
    {
      key: "home",
      label: "Home",
      href: "/",
      Icon: Home,
      active: pathname === "/",
    },
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
      active: pathname.startsWith("/feed"),
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

  const menuActive = menuOpen;

  return (
    <>
      <nav
        ref={bubbleRef}
        style={BUBBLE_OFFSET}
        className="glass-bubble fixed left-1/2 z-[60] -ml-[min(22rem,calc(50vw-0.75rem))] w-[min(44rem,calc(100vw-1.5rem))] rounded-full px-1"
        aria-label="Main"
      >
        <div className={cn("flex items-stretch justify-around", BAR_H)}>
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

        </div>
      </nav>

      {menuOpen && <ExploreSheet onClose={() => setMenuOpen(false)} />}

      {/* Holds the page clear of the bar by exactly its height. shrink-0
          because this is a flex item in the layout's column and a spacer that
          can be squashed is not a spacer. */}
      <div style={SPACER_H} className="shrink-0" aria-hidden />
    </>
  );
}

/** The tab indicator. A dot under the icon rather than a bar on the edge: the
 *  bubble has no edge to sit against any more, and a bar butted up inside a
 *  pill reads as a rendering fault rather than a marker. */
function ActiveBar({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span
      aria-hidden
      className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white"
    />
  );
}

/**
 * The hamburger's sheet: the Explore hub, floating above the bubble.
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
        className="fixed inset-0 z-[55] bg-black/25"
        style={{ bottom: "var(--nav-h)" }}
      />
      <div
        role="dialog"
        aria-label="Explore"
        className="fixed left-1/2 z-[58] -ml-[min(22rem,calc(50vw-0.75rem))] max-h-[70dvh] w-[min(44rem,calc(100vw-1.5rem))] overflow-y-auto rounded-3xl border border-white/10 bg-black/50 px-5 pb-5 pt-5 backdrop-blur-2xl"
        style={{ bottom: "var(--nav-h)" }}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-3">
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
                {item.tier && (
                  <span className="util-label shrink-0 text-[9px] text-carz">
                    {EXPLORE_COPY.tierBadge[item.tier]}
                  </span>
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
    <div className="mt-4 flex flex-wrap items-center justify-center gap-1 border-t border-white/10 pt-3">
      {links.map(({ label, href, Icon }) => (
        <Link
          key={label}
          href={href}
          onClick={onClose}
          className="press util-label flex min-h-[44px] items-center gap-2 rounded-full px-3 opacity-70 transition-opacity hover:opacity-100"
        >
          <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          {label}
        </Link>
      ))}
      {signedIn && (
        <button
          type="button"
          onClick={() => {
            onClose();
            void signOut();
          }}
          className="press util-label flex min-h-[44px] items-center gap-2 rounded-full px-3 opacity-70 transition-opacity hover:opacity-100"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden />
          Sign out
        </button>
      )}
    </div>
  );
}

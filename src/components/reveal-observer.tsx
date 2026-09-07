"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Scroll reveals: any element with class `reveal` fades in and rises when it
 * comes into view. Siblings stagger 70ms. Fires once. Respects reduced motion.
 *
 * `.reveal` starts at `opacity: 0`, so anything this misses is not merely
 * un-animated — it is invisible, permanently. Two ways that used to happen:
 *
 *  1. Content that arrives after the first pass. This ran a single
 *     querySelectorAll 30ms after navigation, which is before any page that
 *     fetches its own data has rendered a row. The leaderboard, auctions,
 *     wishlist, builds and membership all mount their list once a request
 *     resolves — every one of them was never observed, and stayed at zero
 *     opacity for as long as you looked at it. A MutationObserver picks up
 *     whatever appears later.
 *
 *  2. Elements taller than the window. A 0.12 threshold cannot be met by an
 *     element the viewport can only ever cover a tenth of, so a long list
 *     would never reveal no matter how far you scrolled. Asking for any
 *     intersection at all against a root shortened by 12% expresses the same
 *     "a bit of it is up" intent without depending on the element's height.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const revealAll = () =>
      document.querySelectorAll<HTMLElement>(".reveal:not(.in)").forEach((el) => el.classList.add("in"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealAll();
      // Late content still has to appear; it just appears without the motion.
      const mo = new MutationObserver(revealAll);
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    if (typeof IntersectionObserver === "undefined") {
      revealAll();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          const siblings = Array.from(el.parentElement?.children ?? []).filter((c) =>
            c.classList.contains("reveal"),
          );
          const idx = siblings.indexOf(el);
          el.style.transitionDelay = `${Math.max(0, idx) * 70}ms`;
          el.classList.add("in");
          io.unobserve(el);
        });
      },
      // Any intersection, against a root cut 12% short at the bottom: the same
      // "it has come up into view" moment, but reachable by an element that is
      // taller than the window.
      { threshold: 0, rootMargin: "0px 0px -12% 0px" },
    );

    // Re-observing an element already being observed is a no-op, so this is
    // safe to call as often as the DOM changes.
    const observeAll = () =>
      document.querySelectorAll<HTMLElement>(".reveal:not(.in)").forEach((el) => io.observe(el));

    // Coalesced to one pass per frame: a busy page — the feed, a list loading
    // in — can otherwise fire this on every mutation.
    let queued = 0;
    const schedule = () => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        observeAll();
      });
    };

    const t = window.setTimeout(observeAll, 30);
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(t);
      if (queued) cancelAnimationFrame(queued);
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);

  return null;
}

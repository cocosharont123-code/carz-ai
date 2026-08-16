"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Scroll reveals: any element with class `reveal` fades in + rises when 12%
// visible. Siblings are staggered 70ms. Fires once. Respects reduced-motion.
//
// `.reveal` starts at opacity 0, so anything this observer misses stays
// invisible forever. Pages that fetch before they render (auctions,
// leaderboard) mount their cards long after this effect runs, so a one-shot
// pass over the DOM is not enough — a MutationObserver picks up whatever
// arrives late, and a failsafe reveals everything if IO is unavailable.
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const revealAll = () =>
      document.querySelectorAll<HTMLElement>(".reveal:not(.in)").forEach((el) => el.classList.add("in"));

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
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
      { threshold: 0.12 },
    );

    const observeAll = () =>
      document.querySelectorAll<HTMLElement>(".reveal:not(.in)").forEach((el) => io.observe(el));

    // Small timeout so freshly-navigated DOM is present.
    const t = setTimeout(observeAll, 30);

    // Cards that render after a fetch resolves arrive well after that timeout.
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.classList.contains("reveal") && !node.classList.contains("in")) io.observe(node);
          node.querySelectorAll<HTMLElement>(".reveal:not(.in)").forEach((el) => io.observe(el));
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(t);
      mo.disconnect();
      io.disconnect();
    };
  }, [pathname]);

  return null;
}

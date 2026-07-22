"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Scroll reveals: any element with class `reveal` fades in + rises when 12%
// visible. Siblings are staggered 70ms. Fires once. Respects reduced-motion.
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => el.classList.add("in"));
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

    // Small timeout so freshly-navigated DOM is present.
    const t = setTimeout(() => {
      document.querySelectorAll<HTMLElement>(".reveal:not(.in)").forEach((el) => io.observe(el));
    }, 30);

    return () => {
      clearTimeout(t);
      io.disconnect();
    };
  }, [pathname]);

  return null;
}

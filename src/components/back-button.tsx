"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Back, top left, on every page that is not the root of something.
 *
 * In the layout rather than in each page, so a route added later gets it
 * without remembering to. Fixed, because half the app's screens are their own
 * scrollers and a button in the flow would scroll away on some and not others.
 *
 * Hidden on the five destinations the nav itself goes to. Those are where you
 * land, not somewhere you drilled into, and a back arrow on a tab bar
 * destination sends you somewhere arbitrary — whatever tab you happened to be
 * on before.
 */
const ROOTS = new Set(["/", "/spot", "/feed", "/garage", "/leaderboard"]);

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (ROOTS.has(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => {
        // history.back() when there is somewhere to go back to, and the feed
        // otherwise — a deep link opened in a new tab has no history, and a
        // back button that does nothing is worse than no back button.
        if (window.history.length > 1) router.back();
        else router.push("/feed");
      }}
      aria-label="Back"
      style={{ top: "calc(var(--safe-top) + 0.75rem)" }}
      className="press glass-bubble fixed left-3 z-[62] flex h-10 w-10 items-center justify-center rounded-full"
    >
      <ChevronLeft className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden />
    </button>
  );
}

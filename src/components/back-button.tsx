"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Back, top left, on every page but the home page.
 *
 * In the layout rather than in each page, so a route added later gets it
 * without remembering to. Fixed, because half the app's screens are their own
 * scrollers and a button in the flow would scroll away on some and not others.
 *
 * Home is the only exclusion: it is the top of the app, so there is nothing
 * above it to go back to. It was briefly hidden on the other four the nav goes
 * to as well, which in practice meant the arrow was never anywhere.
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/") return null;

  return (
    <>
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

      {/* Holds the page down by the arrow's own height, the way the nav's
          spacer does at the other end. The button is fixed, so without this it
          floats over whatever the page happens to start with — which on most
          screens here is the heading. */}
      <div style={{ height: "var(--back-h)" }} className="shrink-0" aria-hidden />
    </>
  );
}

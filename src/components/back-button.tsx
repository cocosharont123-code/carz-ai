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

  // Not on the sign-in flow. These are full-screen screens with no app behind
  // them to go back to, and step two carries its own back to step one.
  // Home has nowhere to go back to; the sign-in flow is a wall; and the
  // scanner draws its own X, so two back controls would sit on top of each
  // other in the same corner.
  if (pathname === "/" || pathname.startsWith("/signin") || pathname === "/spot") return null;

  return (
    <button
      type="button"
      onClick={() => {
        // history.back() when there is somewhere to go back to, and home
        // otherwise — a deep link opened in a new tab has no history, and a
        // back button that does nothing is worse than no back button.
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
      // The selector globals.css keys the heading clearance off. The spacer
      // that used to do that job sat beside <main> in #app's flow, which §4
      // emptied when it made main absolute; the clearance is main's top
      // padding now.
      aria-label="Back"
      style={{ top: "calc(var(--safe-top) + 0.75rem)" }}
      className="press glass-bubble fixed left-3 z-[62] flex h-10 w-10 items-center justify-center rounded-full"
    >
      <ChevronLeft className="h-5 w-5 text-foreground" strokeWidth={2.5} aria-hidden />
    </button>
  );
}

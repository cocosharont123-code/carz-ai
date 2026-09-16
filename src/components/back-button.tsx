"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Back, top left, on every page.
 *
 * In the layout rather than in each page, so a route added later gets it
 * without remembering to. Fixed, because half the app's screens are their own
 * scrollers and a button in the flow would scroll away on some and not others.
 *
 * It was hidden on the five the nav goes to — the reasoning being that those
 * are where you land rather than somewhere you drilled into. Those are also
 * the five pages anyone is most often on, so in practice the arrow was never
 * there. Every page now, as asked.
 */
export function BackButton() {
  const router = useRouter();

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

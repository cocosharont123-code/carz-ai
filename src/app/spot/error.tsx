"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Anything that throws while rendering /spot lands here.
 *
 * There was no boundary on this route, so a crash in the camera — or anywhere
 * else in a 1,000-line client component — unmounted the tree and left an empty
 * page with nothing to act on and nothing to report. A blank screen is the
 * worst failure mode there is: it looks identical to a broken deploy, a dead
 * network and a bug, so nobody can tell which they are looking at.
 */
export default function SpotError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("spot page crashed:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center px-5 py-16 text-center">
      <h1 className="display text-4xl">Spot hit a snag</h1>
      <p className="mt-3 text-[13px] leading-relaxed opacity-70">
        Something went wrong opening this screen. Trying again usually clears it.
      </p>
      {error?.message && (
        <p className="glass-card mt-4 w-full rounded-2xl px-4 py-3 text-left text-[12px] leading-relaxed opacity-80">
          {error.message}
          {error.digest ? ` (${error.digest})` : ""}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="press mt-6 min-h-11 w-full rounded-full bg-white text-sm font-bold text-black"
      >
        Try again
      </button>
      <Link
        href="/feed"
        className="press glass-card mt-2 flex min-h-11 w-full items-center justify-center rounded-full text-sm font-bold"
      >
        Back to the feed
      </Link>
    </main>
  );
}

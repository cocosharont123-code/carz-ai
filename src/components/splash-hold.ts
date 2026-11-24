"use client";

import { useEffect } from "react";

/**
 * A way for a screen to say "not yet" to the launch splash.
 *
 * The splash lifts when its animation has finished *and* the first screen is
 * actually ready. The animation half it can time itself; the second half only
 * the screen knows -- whether its fetch has landed, whether the session
 * resolved into a signed-in view or a sign-in page. So a screen registers a
 * hold while it is still working, and the splash counts.
 *
 * A counter rather than a boolean: two components on one screen can each be
 * waiting on their own data, and the first one to finish must not speak for
 * the other.
 *
 * Deliberately not React context. The splash is mounted in the root layout
 * above everything, the screens are far below it, and a provider wrapping the
 * whole app so that a <main> can talk to its sibling is a lot of plumbing for
 * one integer. This is a module-level store with a subscription, which is the
 * same thing useSyncExternalStore is built on.
 *
 * Holds added after the splash has already lifted do nothing. That is on
 * purpose -- a splash that came back would be worse than one that left early
 * -- and the hard cap in launch-splash.tsx means a hold that is never
 * released cannot strand anyone either.
 */

let holds = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

export function holdCount(): number {
  return holds;
}

export function subscribeToHolds(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Adds a hold and returns the release. Safe to call twice; each needs its own release. */
export function addSplashHold(): () => void {
  holds += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
    notify();
  };
}

/**
 * Hold the splash while `waiting` is true.
 *
 * ```tsx
 * const { data } = useSomething();
 * useSplashHold(!data);
 * ```
 *
 * The hold is released when `waiting` goes false or the component unmounts,
 * whichever comes first.
 */
export function useSplashHold(waiting: boolean): void {
  useEffect(() => {
    if (!waiting) return;
    return addSplashHold();
  }, [waiting]);
}

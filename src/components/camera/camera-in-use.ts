"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a live camera is open anywhere in the app.
 *
 * The layout runs a full-screen WebGL shader behind every page, and /spot then
 * opens a camera stream on top of it. Two GPU-heavy things at once is more than
 * a phone will reliably give: iOS drops the WebGL context or kills the tab
 * outright, and a killed tab renders as a blank page that no error boundary can
 * catch, because nothing is running to catch it.
 *
 * So the camera says when it is live and the shader stands down. A pub/sub
 * module rather than context: the shader is mounted in the layout, above the
 * provider tree, and this needs no plumbing through it.
 */
let open = 0;
const listeners = new Set<() => void>();

function broadcast() {
  listeners.forEach((fn) => fn());
}

/**
 * Claim the GPU. Call when something heavy starts, release when it ends.
 *
 * Named for the camera because that was the first caller, and kept general
 * because it was never really about cameras: the shader is what stands down,
 * and anything else holding a WebGL context — a map, for one — has exactly the
 * same quarrel with it. /spot rendered a blank page for days over this.
 */
export function claimCamera(): () => void {
  open += 1;
  broadcast();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    open = Math.max(0, open - 1);
    broadcast();
  };
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/**
 * useSyncExternalStore rather than state synced in an effect: this is an
 * external store, which is exactly what it is for, and it reads the current
 * value during render instead of a frame late. The server snapshot is false —
 * there is no camera during SSR — so the markup matches what hydration sees.
 */
export function useCameraInUse(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open > 0,
    () => false,
  );
}

/** The same claim, named for callers that are not a camera. */
export const claimGpu = claimCamera;

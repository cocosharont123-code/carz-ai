"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LiquidGlassLogo } from "@/components/liquid-glass-logo";
import { holdCount, subscribeToHolds } from "@/components/splash-hold";

/**
 * The launch animation, over everything, once per app open.
 *
 * Opening the app used to drop straight into whichever screen was loading,
 * spinners and all. This sits on top of that: a black screen with the glass
 * logo playing while the app mounts, fetches and hydrates underneath, and it
 * lifts only when there is something finished to lift onto.
 *
 * WHAT IT WAITS FOR
 *
 * Two independent things, both required.
 *
 * The animation. LiquidGlassLogo has no completion callback, so the timing
 * is read from the installed renderer rather than guessed: the clock only
 * advances once the logo raster is uploaded, which is the same moment it
 * calls onReady and the root element gains data-liquid-glass-ready, and the
 * sequence for ending="logo" ends at logoFinishTime = 1.8s of clock, which
 * at speed 1 is 1.8s of wall time. So the timer starts from the attribute,
 * not from mount -- on a slow connection the image lands late and a timer
 * started at mount would cut the animation in half.
 *
 * The screen. Fonts loaded, the images already in the document decoded, and
 * no screen holding the splash open through useSplashHold.
 *
 * WHAT STOPS IT WAITING
 *
 * Three nets, because a splash that never lifts is a broken app:
 *
 *  - no data-liquid-glass-ready within 2s -- the logo failed to load, or
 *    there is no WebGL2 and the static fallback is showing -- hold 1s, lift;
 *  - reduced motion: the renderer jumps straight to the finished logo, so
 *    there is nothing to wait for. Hold 1s, lift;
 *  - 6s from navigation, lift regardless, whatever anything else says.
 */

/** logoFinishTime in liquid-glass-logo-renderer.ts, at the default speed of 1. */
const ANIMATION_MS = 1800;
/**
 * The renderer draws the frame at the end of the sequence and stops; this is
 * the beat that keeps the lift from starting on the frame the logo lands.
 */
const SETTLE_MS = 160;
/** No ready attribute by now means the canvas is never coming. */
const READY_TIMEOUT_MS = 2000;
/** What a static logo gets instead of an animation, in both fallback cases. */
const STILL_HOLD_MS = 1000;
/** From navigation start, not from mount. */
const HARD_CAP_MS = 6000;
/** §6: a presentation leaving the screen. */
const FADE_MS = 350;

/** Set once the splash has been shown, so a reload mid-session goes straight in. */
export const SPLASH_FLAG = "carz-splash-shown";

/** The tabs, warmed once the animation is done so the first switch is instant. */
const TABS = ["/", "/map", "/spot", "/hunt", "/profile"] as const;

/**
 * Fonts, and the images already in the document.
 *
 * Not every image on the page: lazy ones are below the fold by definition,
 * and waiting for them would mean waiting for a scroll that has not happened.
 * Its own ceiling, so a never-decoding image cannot outlast the splash's own
 * nets.
 */
function whenPainted(): Promise<void> {
  const fonts = document.fonts?.ready?.catch(() => undefined) ?? Promise.resolve();
  const images = Array.from(document.images)
    .filter((img) => img.loading !== "lazy" && !img.complete)
    .map((img) => img.decode().catch(() => undefined));
  const ceiling = new Promise<void>((resolve) => setTimeout(resolve, 2500));
  return Promise.race([Promise.all([fonts, ...images]).then(() => undefined), ceiling]);
}

export function LaunchSplash() {
  const router = useRouter();
  /** "up" while it covers the app, "fading" during the 350ms, then unmounted. */
  const [phase, setPhase] = useState<"up" | "fading" | "gone">("up");
  const host = useRef<HTMLDivElement>(null);
  /** Both halves, tracked outside state: nothing here needs a re-render. */
  const done = useRef({ animation: false, screen: false });
  const lifted = useRef(false);

  useEffect(() => {
    /**
     * A reload inside the same session goes straight to the app.
     *
     * The flag is read before first paint by the script in the layout, which
     * hides this with CSS -- this is the other half, unmounting what that
     * script hid. Coming back from Google's sign-in page is the case that
     * matters: it is a fresh document, and without the flag it would play
     * the whole thing again on the way back in.
     */
    let seen = false;
    try {
      seen = sessionStorage.getItem(SPLASH_FLAG) === "1";
      sessionStorage.setItem(SPLASH_FLAG, "1");
    } catch {
      /* private mode: the splash plays, which is the harmless direction */
    }
    if (seen) {
      // Deferred, not synchronous: a setState inside an effect body cascades
      // a second render pass. CSS has already hidden this element before the
      // first paint, so nothing is on screen during the microtask either way.
      void Promise.resolve().then(() => setPhase("gone"));
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms));

    const lift = () => {
      if (lifted.current) return;
      lifted.current = true;
      setPhase("fading");
      // Unmounted after the fade rather than hidden: the canvas holds a WebGL
      // context, and this app has exactly one to spare -- the map takes it.
      later(() => setPhase("gone"), FADE_MS);
    };

    const tryLift = () => {
      if (done.current.animation && done.current.screen && holdCount() === 0) lift();
    };

    const finishAnimation = () => {
      if (done.current.animation) return;
      done.current.animation = true;
      // Not blocking the lift on this, per the brief: it is warming, not work.
      for (const href of TABS) router.prefetch(href);
      tryLift();
    };

    // --- the animation half -------------------------------------------------
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const root = host.current;
    const isReady = () => !!root?.querySelector("[data-liquid-glass-ready]");

    if (reduced) {
      later(finishAnimation, STILL_HOLD_MS);
    } else if (isReady()) {
      later(finishAnimation, ANIMATION_MS + SETTLE_MS);
    } else {
      const observer = new MutationObserver(() => {
        if (!isReady()) return;
        observer.disconnect();
        later(finishAnimation, ANIMATION_MS + SETTLE_MS);
      });
      if (root) {
        observer.observe(root, { subtree: true, attributes: true, attributeFilter: ["data-liquid-glass-ready"] });
        timers.push(setTimeout(() => {
          if (done.current.animation || isReady()) return;
          // Nothing ever reported ready: a still logo, or no logo at all.
          observer.disconnect();
          later(finishAnimation, STILL_HOLD_MS);
        }, READY_TIMEOUT_MS));
      }
      timers.push(setTimeout(() => observer.disconnect(), HARD_CAP_MS));
    }

    // --- the screen half ----------------------------------------------------
    void whenPainted().then(() => {
      done.current.screen = true;
      tryLift();
    });
    const unsubscribe = subscribeToHolds(tryLift);

    // --- the net ------------------------------------------------------------
    later(lift, Math.max(0, HARD_CAP_MS - performance.now()));

    return () => {
      unsubscribe();
      for (const t of timers) clearTimeout(t);
    };
    // Mount only: everything this coordinates lives in refs and the DOM.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      ref={host}
      className="launch-splash"
      data-phase={phase}
      aria-hidden
      /* Inline, not only in the stylesheet: this is the first frame, and it
         has to be black even in the instant before anything else applies. */
      style={{ background: "#000" }}
    >
      <LiquidGlassLogo
        logo="/carz-ai-logo.png"
        logoColor="original"
        ending="logo"
        aria-label="Carz AI"
        style={{ height: "100dvh" }}
      />
    </div>
  );
}

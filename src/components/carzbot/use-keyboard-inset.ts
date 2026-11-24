"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The keyboard, as a number the chat screen can position against.
 *
 * WHAT ACTUALLY JUMPS
 *
 * iOS does not shrink the layout viewport for the keyboard. It lays the
 * keyboard over the page and then scrolls to reveal the focused field --
 * and because the composer sits at the bottom of a full-height screen, that
 * scroll is large. It moves the *visual* viewport (offsetTop) and, when the
 * focused field is inside a scrollable element, that element too. The
 * heading sliding under the status bar and the back button vanishing is
 * that scroll, not a layout change.
 *
 * Two things in this app were adding to it. The old lift hook jumped the
 * thread to the bottom the instant the keyboard appeared, and the
 * stick-to-bottom helper ran a smooth scrollTo on every turn; both land on
 * top of the system's own scroll, which is what made it read as laggy
 * rather than merely wrong.
 *
 * WHAT THIS DOES INSTEAD
 *
 * Measures the keyboard and writes it to a CSS variable on the shell. No
 * React state per event, so nothing re-renders while the keyboard animates
 * -- the only consumer is a transform in CSS.
 *
 *   keyboard = innerHeight - visualViewport.height
 *
 * and then it undoes the system scroll on every event, which is the half
 * that actually stops the page moving.
 *
 * offsetTop is deliberately *not* in that subtraction, which is the one
 * place this departs from the usual recipe. The usual recipe is right for a
 * page that lets iOS pan it: part of the missing height is then above the
 * visible area rather than keyboard. This page cancels the pan on every
 * event, so offsetTop is a transient that is on its way back to zero, and
 * subtracting it makes the keyboard read short for a few frames -- measured
 * at 156px for a 336px keyboard mid-pan, which drops the composer onto the
 * keys and then lifts it again. offsetTop drives the counter-offset below
 * instead, which is the thing it actually describes.
 *
 * WHAT THE COMPOSER MOVES BY
 *
 * Not the keyboard height. The composer is sticky, not fixed: on the empty
 * screen it sits halfway up, under the heading, and translating it by a
 * whole keyboard sent it off the top of the screen -- measured with its
 * field at y=1. --lift is the distance from its own bottom edge down to the
 * top of the keys, and zero when it is already above them.
 *
 * TIMING
 *
 * visualViewport fires late on iOS -- the keyboard is most of the way up
 * before the first resize lands -- so the move starts on focusin from the
 * last height this session measured, and corrects when the real number
 * arrives. The first ever focus has nothing cached and uses a typical
 * iPhone keyboard; being 20px out for 150ms is invisible next to starting
 * 300ms late.
 *
 * On iOS 26 the values can stay wrong after dismissal, so blur resets to
 * zero outright rather than believing a measurement.
 */

/** Big enough to be a keyboard and not a toolbar. */
const KEYBOARD_FLOOR = 120;
/** The gap asked for between the box and the keys. */
const GAP = 8;
/** iPhone keyboard plus the ⌃ ⌄ ✓ accessory bar, for the very first focus. */
const TYPICAL_KEYBOARD = 336;
/** Remembered across focuses within the session. */
let lastMeasured = 0;

/**
 * @param onChange run with the new keyboard height whenever it changes, for
 * the one thing CSS cannot do: keeping the newest message clear of the box.
 * Called, never written to, so it does not fall foul of the compiler's rule
 * about mutating hook arguments.
 */
export function useKeyboardInset(onChange?: (kb: number) => void) {
  const shell = useRef<HTMLDivElement>(null);
  /** Only for the debug readout; the layout never reads this. */
  const [debug, setDebug] = useState({ inner: 0, vv: 0, offset: 0, scrollY: 0, kb: 0 });
  const debugOn = useRef(false);

  const current = useRef(0);

  const write = useCallback(
    (px: number) => {
      const el = shell.current;
      const kb = Math.max(0, Math.round(px));
      if (!el || kb === current.current) return;
      current.current = kb;
      el.style.setProperty("--kb", `${kb}px`);
      // A flag rather than arithmetic on a length: the bottom safe-area
      // padding belongs under a composer resting on the home indicator and
      // not under one floating above a keyboard.
      el.style.setProperty("--kb-closed", kb ? "0" : "1");

      /**
       * How far this particular composer has to move.
       *
       * Measured untransformed -- the old lift is cleared first -- or the
       * rect would be read through the last move and the box would climb
       * with every event.
       */
      let lift = 0;
      if (kb) {
        /**
         * The box, not the block around it.
         *
         * The sticky container also holds the starter chips, and lifting
         * all of it put the field a third of the way up an empty screen.
         * The chips are allowed behind the keyboard -- they are shortcuts
         * for a thread that has not started, and the thing that has to
         * clear the keys is the box you are typing into.
         */
        const box = el.querySelector<HTMLElement>(".carzbot-box");
        if (box) {
          const previous = box.style.getPropertyValue("transition");
          box.style.setProperty("transition", "none");
          el.style.setProperty("--lift", "0px");
          const bottom = box.getBoundingClientRect().bottom;
          box.style.setProperty("transition", previous);
          lift = Math.max(0, Math.round(bottom - (window.innerHeight - kb) + GAP));
        }
      }
      el.style.setProperty("--lift", `${lift}px`);
      onChange?.(kb);
    },
    [onChange],
  );

  useEffect(() => {
    const vv = window.visualViewport;

    /**
     * Undo the system's scroll.
     *
     * Both halves: the document, which iOS scrolls on a page it considers
     * scrollable, and the shell's own offset against a panned visual
     * viewport. Done on every event rather than once, because iOS pans
     * again as the keyboard settles and again when the accessory bar
     * appears.
     */
    const cancelPan = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      const el = shell.current;
      if (!el) return;
      /**
       * Only while the keyboard is actually up.
       *
       * The counter-offset exists to cancel a real displacement: iOS pans
       * the visual viewport to reveal the field, and translating the shell
       * back by the same amount leaves the screen where it was. If
       * offsetTop is ever non-zero without that displacement -- which is
       * exactly the iOS 26 complaint, stale values after dismissal -- then
       * applying it would shove the whole screen down instead. Tying it to
       * a measured keyboard bounds that to the moment it is true.
       */
      const panning = vv && vv.offsetTop > 0 && current.current > 0;
      el.style.setProperty("--pan", panning ? `${Math.round(vv.offsetTop)}px` : "0px");
    };

    const measure = () => {
      if (!vv) return;
      const raw = Math.round(window.innerHeight - vv.height);
      const kb = raw > KEYBOARD_FLOOR ? raw : 0;
      if (kb) lastMeasured = kb;
      write(kb);
      cancelPan();
      if (debugOn.current) {
        setDebug({
          inner: Math.round(window.innerHeight),
          vv: Math.round(vv.height),
          offset: Math.round(vv.offsetTop),
          scrollY: Math.round(window.scrollY),
          kb,
        });
      }
    };

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.matches?.("textarea, input")) return;
      // Move now on the cached height; `measure` corrects it in a moment.
      write(lastMeasured || TYPICAL_KEYBOARD);
      cancelPan();
    };

    const onFocusOut = () => {
      // Explicit, not measured: after a dismissal iOS can report a viewport
      // that still has a keyboard in it.
      write(0);
      requestAnimationFrame(cancelPan);
    };

    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    // iOS keeps panning after the keyboard settles; this catches the rest.
    window.addEventListener("scroll", cancelPan, { passive: true });
    measure();

    return () => {
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", cancelPan);
    };
  }, [write]);

  /** Triple-tap the heading to show what the viewport is reporting. */
  const taps = useRef<number[]>([]);
  const onHeadingTap = useCallback(() => {
    const now = Date.now();
    taps.current = [...taps.current, now].filter((t) => now - t < 600);
    if (taps.current.length < 3) return;
    taps.current = [];
    debugOn.current = !debugOn.current;
    setDebug((d) => ({ ...d, inner: debugOn.current ? Math.round(window.innerHeight) : 0 }));
  }, []);

  return { shell, onHeadingTap, debug, debugVisible: () => debugOn.current };
}

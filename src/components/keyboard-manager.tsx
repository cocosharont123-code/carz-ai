"use client";

import { useEffect } from "react";

/**
 * The keyboard, handled once for the whole app.
 *
 * WHAT GOES WRONG WITHOUT IT
 *
 * iOS does not shrink the layout viewport when the keyboard opens. It lays
 * the keyboard over the page and then scrolls to reveal the focused field.
 * Because this app's document cannot scroll -- html and body are
 * overflow:hidden, §4 -- what iOS scrolls instead is the *visual* viewport,
 * which drags the entire screen upward: header, back button, tab bar and
 * all. That is the "whole page pushes up" on every screen with a field on
 * it, and no amount of dvh or position:fixed prevents it, because nothing
 * about the layout has changed.
 *
 * WHAT THIS DOES
 *
 * Three things, on every screen, from the root layout:
 *
 *  - measures the keyboard and publishes it as --kb on <html>, so anything
 *    anchored to the bottom can lift itself with a transform;
 *  - cancels the system scroll, which is what actually holds the page
 *    still: scrollTo(0,0) for the document, and a counter-offset on #app
 *    for the panned visual viewport;
 *  - brings the focused field into view itself, by scrolling the screen's
 *    own scroller by the smallest amount that clears the keys. That is the
 *    job iOS was doing badly: the app's scroller moves content without
 *    moving the chrome around it.
 *
 * It was written for the CarzBot composer first and scoped to that screen,
 * which was the wrong scope -- every field in the app has the same problem.
 */

/** Big enough to be a keyboard rather than a toolbar. */
const KEYBOARD_FLOOR = 120;
/** Breathing room between the field and the keys. */
const GAP = 12;

const isField = (el: EventTarget | null): el is HTMLElement =>
  el instanceof HTMLElement &&
  (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

export function KeyboardManager() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    let keyboard = 0;

    const shell = () => document.getElementById("app");

    /**
     * Undo the system scroll.
     *
     * Gated on a measured keyboard: the counter-offset exists to cancel a
     * real displacement, and iOS can report a stale offsetTop after the
     * keyboard has gone -- applying that would shove the screen down for no
     * reason.
     */
    const hold = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      const app = shell();
      if (!app) return;
      const pan = keyboard > 0 && vv.offsetTop > 0 ? Math.round(vv.offsetTop) : 0;
      app.style.transform = pan ? `translate3d(0, ${pan}px, 0)` : "";
    };

    /**
     * The smallest scroll that clears the keys.
     *
     * The screen's own scroller, not the document: content moves, the back
     * button and the tab bar do not. Nothing happens when the field is
     * already above the keyboard, which is the common case for anything but
     * a composer at the bottom.
     */
    const reveal = () => {
      const el = document.activeElement;
      if (!isField(el) || !keyboard) return;
      const scroller = el.closest("main");
      if (!(scroller instanceof HTMLElement)) return;
      const hidden = el.getBoundingClientRect().bottom - (window.innerHeight - keyboard) + GAP;
      if (hidden > 0) scroller.scrollTop += hidden;
    };

    const measure = () => {
      frame = 0;
      const raw = Math.round(window.innerHeight - vv.height);
      const next = raw > KEYBOARD_FLOOR ? raw : 0;
      const changed = next !== keyboard;
      keyboard = next;
      if (changed) {
        root.style.setProperty("--kb", `${keyboard}px`);
        root.style.setProperty("--kb-closed", keyboard ? "0" : "1");
      }
      hold();
      if (changed && keyboard) requestAnimationFrame(reveal);
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const onFocusOut = () => {
      // Explicit rather than measured: after a dismissal iOS can still
      // report a viewport with a keyboard in it.
      keyboard = 0;
      root.style.setProperty("--kb", "0px");
      root.style.setProperty("--kb-closed", "1");
      const app = shell();
      if (app) app.style.transform = "";
      requestAnimationFrame(() => {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      });
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("focusin", schedule);
    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("scroll", hold, { passive: true });
    measure();

    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("focusin", schedule);
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("scroll", hold);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

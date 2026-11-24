"use client";

import { useEffect, useRef, useState } from "react";

/** The one curve in the brief, used by the scroll easing and the keyframes. */
export const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Live, because someone can change it in Settings with the chat open. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * A steady stream out of a jumpy one.
 *
 * Tokens arrive from the model in clumps -- forty characters, then nothing
 * for 300ms, then eighty -- and rendering each clump on arrival is the
 * stutter the brief is about. So arrivals go into a buffer and a
 * requestAnimationFrame loop lets characters out of it at a rate the eye
 * reads as typing.
 *
 * The rate is proportional, not fixed: each frame releases a fraction of
 * whatever is waiting, with a floor of one character. A fixed rate either
 * crawls behind a fast answer or empties instantly on a slow one; a
 * proportional one is quick when there is a backlog, unhurried when the model
 * is thinking, and always arrives at the same moment the stream ends.
 *
 * `text` is state because it is what renders; the buffer and the frame handle
 * are refs because nothing should re-render when they change.
 */
export function useTypedStream(reduced: boolean) {
  const [text, setText] = useState("");
  const buffer = useRef("");
  const shown = useRef(0);
  const frame = useRef(0);
  /** Resolved once the buffer has been fully revealed and the source is done. */
  const closed = useRef(false);
  const onDrain = useRef<(() => void) | null>(null);

  const stop = () => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  };

  useEffect(() => stop, []);

  const pump = () => {
    frame.current = 0;
    const pending = buffer.current.length - shown.current;
    if (pending > 0) {
      // A twelfth of the backlog per frame: at 60fps a 600-character answer
      // that lands in one chunk takes about half a second to read out, and a
      // trickle keeps pace with the trickle.
      const step = Math.max(1, Math.ceil(pending / 12));
      shown.current += step;
      setText(buffer.current.slice(0, shown.current));
    }
    if (buffer.current.length > shown.current) {
      frame.current = requestAnimationFrame(pump);
      return;
    }
    if (closed.current) onDrain.current?.();
  };

  const push = (chunk: string) => {
    buffer.current += chunk;
    if (reduced) {
      // No typing effect: the words appear as they arrive, which is what
      // "reduce motion" means for text that is already moving.
      shown.current = buffer.current.length;
      setText(buffer.current);
      return;
    }
    if (!frame.current) frame.current = requestAnimationFrame(pump);
  };

  /** Tells the loop there is no more input; resolves when the last char is out. */
  const finish = () =>
    new Promise<string>((resolve) => {
      closed.current = true;
      const done = () => resolve(buffer.current);
      if (reduced || buffer.current.length === shown.current) {
        done();
        return;
      }
      onDrain.current = done;
      if (!frame.current) frame.current = requestAnimationFrame(pump);
    });

  const reset = () => {
    stop();
    buffer.current = "";
    shown.current = 0;
    closed.current = false;
    onDrain.current = null;
    setText("");
  };

  return { text, push, finish, reset };
}

/**
 * Follow the thread down, unless the reader has gone looking.
 *
 * Scrolling up during an answer is a deliberate act -- rereading the question,
 * checking the table that just went past -- and a chat that yanks you back is
 * the single most irritating thing a chat can do. Once you are more than a
 * bubble's height off the bottom, following stops; come back and it resumes.
 *
 * The scroller is the page's <main> (§4: one per screen), found from the
 * thread rather than by document.querySelector, so this stays correct if the
 * chat is ever mounted somewhere else.
 */
export function useStickToBottom(anchor: React.RefObject<HTMLElement | null>) {
  const scroller = useRef<HTMLElement | null>(null);
  const following = useRef(true);

  useEffect(() => {
    const el = anchor.current?.closest("main");
    if (!(el instanceof HTMLElement)) return;
    scroller.current = el;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      following.current = gap < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [anchor]);

  /**
   * @param smooth for the jump to a new message. While text streams this is
   * false: the content grows a few pixels per frame, so setting scrollTop
   * directly *is* the smooth version -- a smooth scroll restarted every frame
   * never finishes and the thread crawls behind the text.
   */
  const follow = (smooth: boolean) => {
    const el = scroller.current;
    if (!el || !following.current) return;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  };

  /** A new question is always followed, wherever the reader was. */
  const snapBack = () => {
    following.current = true;
  };

  return { follow, snapBack };
}

/**
 * Lift the composer above the keyboard.
 *
 * iOS does not move the page when the keyboard opens. The layout viewport
 * keeps its full height and the keyboard is painted over the bottom of it,
 * so a composer stuck to bottom-0 is behind the keys -- you type into a box
 * you cannot see. Only the *visual* viewport knows: its height shrinks by
 * the keyboard, and offsetTop grows when Safari scrolls it to reveal a
 * focused field.
 *
 * overlap = layout height - (visual height + how far it has been scrolled).
 * That is how many pixels of page the keyboard is covering.
 *
 * The composer does not move by that number, though, which was the first
 * version of this and was wrong: with a short thread the composer is already
 * well above the bottom of the screen -- it is sticky, not fixed -- and
 * shifting it by a whole keyboard's height threw it off the top. What it
 * moves by is the overlap between *itself* and the keyboard: the distance
 * from its own bottom edge down to the top of the keys, and nothing when it
 * is already above that line.
 *
 * transform, not bottom: §1 allows transform and opacity and nothing else,
 * and this runs while the keyboard animates up. The thread's padding is a
 * separate matter -- a discrete change when the keyboard opens and closes,
 * not a per-frame one -- and it is what keeps the newest message from
 * hiding behind the lifted composer.
 *
 * Every read happens inside a rAF: visualViewport fires resize and scroll in
 * bursts while the keyboard animates, and reading offsetTop in the handler
 * measures mid-animation values that the next frame throws away.
 *
 * The hook owns both refs rather than taking them. Reaching through a hook
 * argument to set a style is mutating the caller's object, which the React
 * Compiler rejects -- and it is right to: a hook that writes into something
 * handed to it is a hook you cannot read the call site of.
 */
export function useKeyboardLift() {
  const composer = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    let last = -1;

    const apply = () => {
      frame = 0;
      /**
       * Read the refs here, not at setup.
       *
       * The thread only exists once there is a turn in it -- an empty
       * CarzBot renders the "What can I tell you?" panel instead -- so a
       * reference captured when this effect ran is null for the whole of
       * the first conversation. The composer is always mounted; the thread
       * is the one that catches this out.
       */
      const box = composer.current;
      const list = thread.current;
      const overlap = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));

      let lift = 0;
      if (box && overlap) {
        // Untransformed first: a rect measured through the last lift would
        // compound, and the box would climb with every event.
        box.style.transform = "";
        const bottom = box.getBoundingClientRect().bottom;
        lift = Math.max(0, Math.round(bottom - (window.innerHeight - overlap)));
      }
      if (lift === last) {
        if (box && lift) box.style.transform = `translate3d(0, -${lift}px, 0)`;
        return;
      }
      last = lift;
      if (box) box.style.transform = lift ? `translate3d(0, -${lift}px, 0)` : "";
      if (list) list.style.paddingBottom = lift ? `${lift}px` : "";
      /**
       * Straight to the bottom when the keyboard arrives.
       *
       * Unconditional, unlike the follow during streaming: the keyboard only
       * opens because the composer was tapped, and someone about to type is
       * someone who wants to see the end of the conversation. The screen has
       * just lost half its height to the keys, so without this the message
       * being answered slides out of view at the moment of answering it.
       */
      const scroller = list?.closest("main");
      if (lift && scroller instanceof HTMLElement) scroller.scrollTop = scroller.scrollHeight;
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    apply();
    return () => {
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      if (frame) cancelAnimationFrame(frame);
      // No styles to undo: this effect lives as long as the chat does, so
      // the only thing that ends it is the screen going away and taking
      // both elements with it.
    };
  }, []);

  return { composer, thread };
}

"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Gauge, Wrench, BadgeDollarSign, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/carzbot/markdown";
import {
  useReducedMotion,
  useStickToBottom,
  useTypedStream,
} from "@/components/carzbot/chat-motion";
import { useKeyboardInset } from "@/components/carzbot/use-keyboard-inset";

/**
 * CarzBot, as a chat.
 *
 * It was the morph orb: one question, one answer, a ball that flew up the
 * screen and unfolded into a card, and nowhere to put a second question. The
 * route has always taken a transcript -- it sends the last twelve turns -- so
 * the orb was throwing away the one thing the model needed to answer a
 * follow-up. This is a thread.
 *
 * The shape is the composer that came with the request: a rounded box with the
 * field inside it and the send button in its own row underneath, with starter
 * prompts below that while the thread is empty. Built on this app's own glass
 * and tokens rather than the `bg-neutral-900` the reference hardcodes, and
 * without the attach button -- CarzBot takes text, photographs go to Spot, and
 * a paperclip that opens nothing is worse than no paperclip.
 */

type Turn = { role: "user" | "assistant"; content: string };

/**
 * The finished turns.
 *
 * Its own component, memoised on the array, so the thread does not re-render
 * on every character of the answer being typed out below it -- which at 60fps
 * for the length of an answer is the difference between a chat and a slide
 * show. The array identity only changes when a turn is added, which is
 * exactly when this should redraw.
 */
const Thread = memo(function Thread({ turns }: { turns: Turn[] }) {
  return (
    <>
      {turns.map((t, i) =>
        t.role === "user" ? (
          <p
            key={i}
            className="msg-in ml-auto max-w-[85%] rounded-card bg-carz px-4 py-2.5 text-[15px] leading-relaxed text-carz-ink"
          >
            {t.content}
          </p>
        ) : (
          <div key={i} className="msg-in glass-card max-w-[92%] space-y-3 rounded-card px-4 py-3">
            <Markdown text={t.content} />
          </div>
        ),
      )}
    </>
  );
});

/**
 * Three dots, where the answer will be.
 *
 * Inside the assistant's own bubble rather than a line of text above it, so
 * when the first words arrive the dots fade out and the answer fades in
 * inside the same box -- no second bubble appearing, nothing jumping. The
 * wave is opacity and scale on a 1.2s loop, staggered by 160ms, which is the
 * stagger that reads as one wave rather than three separate blinks.
 */
function ThinkingDots() {
  return (
    <span className="flex h-[22px] items-center gap-1.5" role="status" aria-label="CarzBot is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="carz-dot h-[7px] w-[7px] rounded-full bg-[var(--color-secondary-text)]"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

const STARTERS = [
  { icon: GitCompareArrows, label: "GT3 RS or 911 Turbo S?" },
  { icon: BadgeDollarSign, label: "What's an E46 M3 worth now?" },
  { icon: Wrench, label: "What goes wrong on an F-Type?" },
  { icon: Gauge, label: "Fastest car under $50k?" },
] as const;

/**
 * Grow with the text, up to a point.
 *
 * Measured by shrinking to the minimum first: scrollHeight is the content's
 * height *or* the box's, whichever is larger, so a field that has already
 * grown never reports a smaller number and can only ratchet upwards.
 */
function useAutoResize(min: number, max: number) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(
    (reset?: boolean) => {
      const el = ref.current;
      if (!el) return;
      el.style.height = `${min}px`;
      if (reset) return;
      el.style.height = `${Math.max(min, Math.min(el.scrollHeight, max))}px`;
    },
    [min, max],
  );

  return { ref, resize };
}

export function CarzBotChat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { ref: fieldRef, resize } = useAutoResize(52, 160);
  const endRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  /**
   * Keep the newest message clear of the lifted composer.
   *
   * The only part of this the CSS variable cannot do. Adding room under the
   * thread does not move what is already on screen, so a message sitting
   * where the composer has just risen to would be behind it -- this scrolls
   * the thread by exactly the overlap and no more. Not "scroll to the
   * bottom": that was the old behaviour and it threw the conversation
   * around every time the keyboard appeared.
   */
  const onKeyboard = useCallback((kb: number) => {
    const list = threadRef.current;
    const scroller = list?.closest("main");
    if (!list || !(scroller instanceof HTMLElement) || !kb) return;
    requestAnimationFrame(() => {
      const last = list.lastElementChild?.previousElementSibling;
      if (!(last instanceof HTMLElement)) return;
      const hidden = last.getBoundingClientRect().bottom - (window.innerHeight - kb);
      if (hidden > 0) scroller.scrollTop += hidden + 12;
    });
  }, []);

  const { shell: shellRef, onHeadingTap, debug, debugVisible } = useKeyboardInset(onKeyboard);
  const reduced = useReducedMotion();
  /** The answer being typed out; "" while the dots are up. */
  const stream = useTypedStream(reduced);
  const { follow, snapBack } = useStickToBottom(threadRef);

  /**
   * The field fits whatever is in it, however it got there.
   *
   * Keyed on the value rather than called from onChange, because typing is not
   * the only thing that fills this box: a failed send puts the question back,
   * and that text arrived at a field still sized for an empty one -- two lines
   * of it were clipped behind the bottom edge. One effect covers typing, the
   * rollback and a cleared field alike.
   */
  useEffect(() => {
    resize(!value);
  }, [value, resize]);

  /**
   * Follow the conversation down.
   *
   * Two cases with different needs. A new bubble is a jump, so it gets a
   * smooth scroll; a streaming answer grows a few pixels per frame, so it
   * gets scrollTop set directly -- a smooth scroll restarted every frame
   * never finishes and the view crawls behind the words. Both stop if the
   * reader has scrolled up.
   */
  useEffect(() => {
    follow(!reduced);
    // follow reads refs only; re-running it on every turn is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, busy]);

  useEffect(() => {
    if (stream.text) follow(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.text]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const history = turns;
    const next: Turn[] = [...history, { role: "user", content: question }];
    setTurns(next);
    setValue("");
    setError("");
    setBusy(true);
    snapBack();
    stream.reset();

    try {
      const res = await fetch("/api/carzbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      /**
       * Every refusal arrives as JSON with a status, because every one of
       * them -- not configured, not signed in, not a member, too fast --
       * happens before the model is called and therefore before a single
       * token exists. Once the body is streaming it is plain text and there
       * is no status left to send.
       */
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        /**
         * Put the thread back as it was.
         *
         * Each of those refusals is a reason the question was never asked, so
         * leaving it on screen above an error reads as a question that was
         * answered badly. Rolling back restores the starters and puts the
         * text back in the box to send again.
         */
        setTurns(history);
        setValue(question);
        setError(data?.error || "CarzBot couldn't answer that one.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        // stream: true, so a multi-byte character split across two chunks is
        // held until its second half arrives rather than drawn as a lozenge.
        stream.push(decoder.decode(chunk, { stream: true }));
      }
      const full = (await stream.finish()).trim();

      if (!full) {
        setTurns(history);
        setValue(question);
        setError("CarzBot couldn't answer that one.");
        return;
      }

      /**
       * The typed-out text and the committed turn swap in the same commit.
       *
       * They are identical strings by this point, so the bubble does not
       * change -- but they are rendered by different components, and doing it
       * in two steps would unmount one and mount the other with a frame of
       * nothing in between.
       */
      setTurns([...next, { role: "assistant", content: full }]);
      stream.reset();
    } catch {
      setTurns(history);
      setValue(question);
      setError("No connection to CarzBot. Check your network and try again.");
      stream.reset();
    } finally {
      setBusy(false);
    }
  }

  const empty = turns.length === 0;

  return (
    // The page's <main> is the scroller (§4). The composer sticks to its
    // bottom rather than the thread getting a scroller of its own.
    <div ref={shellRef} className="carzbot-screen flex min-h-full flex-col px-5 pb-4">
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          {/* Triple-tap toggles the viewport readout. Temporary, and the
              only way to see these numbers on a device with no inspector. */}
          <h1 onClick={onHeadingTap} className="display text-[34px] leading-tight">
            What can I tell you?
          </h1>
          <p className="mt-3 max-w-[18rem] text-[15px] leading-relaxed text-[var(--color-secondary-text)]">
            Specs, values, what to look for, how to tell two cars apart.
          </p>
        </div>
      ) : (
        <div ref={threadRef} className="flex-1 space-y-4 py-4">
          <Thread turns={turns} />

          {/* The assistant's bubble, up from the moment the question is sent.
          
              One bubble for both states: the dots are inside it and the
              answer replaces them in place, so there is no second bubble
              appearing and nothing below it moves except by the height of
              the words themselves. It mounts in the same commit as the
              question, which is well inside the 100ms the brief asks for --
              no timer, because a timer is a way of being late on purpose. */}
          {busy && (
            <div className="msg-in glass-card max-w-[92%] space-y-3 rounded-card px-4 py-3">
              {stream.text ? (
                <div className="crossfade-in">
                  <div className="space-y-3">
                    <Markdown text={stream.text} />
                  </div>
                </div>
              ) : (
                <ThinkingDots />
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {debugVisible() && (
        <div className="pointer-events-none fixed left-2 top-2 z-50 rounded-[8px] bg-black/80 px-2 py-1 font-mono text-[10px] leading-tight text-white">
          innerHeight {debug.inner}
          <br />
          vv.height {debug.vv}
          <br />
          vv.offsetTop {debug.offset}
          <br />
          scrollY {debug.scrollY}
          <br />
          keyboard {debug.kb}
        </div>
      )}

      {error && (
        <p role="alert" className="mb-3 text-center text-[14px] text-error">
          {error}
        </p>
      )}

      {/* The composer. Sticky so it stays reachable in a long thread, and
          bottom-0 against a <main> whose own padding already clears the tab
          bar. */}
      <div className="carzbot-composer sticky bottom-0 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(value);
          }}
          className="carzbot-box glass-card rounded-card"
        >
          <label className="sr-only" htmlFor="carzbot-field">
            Ask CarzBot anything
          </label>
          <textarea
            id="carzbot-field"
            ref={fieldRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends on a keyboard; Shift+Enter is a new line. A phone
              // keyboard's return key inserts a newline, which is why the send
              // button is a button and not a hint.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(value);
              }
            }}
            placeholder="Ask CarzBot anything…"
            rows={1}
            // 16px minimum, or iOS zooms the page when the field takes focus.
            className="w-full resize-none bg-transparent px-4 pt-3.5 text-[16px] leading-relaxed text-foreground outline-none placeholder:text-[var(--color-muted-text)]"
          />
          <div className="flex items-center justify-end px-2.5 pb-2.5">
            <button
              type="submit"
              disabled={!value.trim() || busy}
              aria-label="Send"
              className={cn(
                "press flex h-11 w-11 items-center justify-center rounded-full transition-colors",
                value.trim() && !busy
                  ? "bg-carz text-carz-ink"
                  : "glass-chip text-[var(--color-muted-text)]",
              )}
            >
              <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
        </form>

        {/* Starters, while there is nothing to read. They fill the box and
            send in one tap -- a chip that only types a noun leaves you to
            write the rest of the question yourself. */}
        {empty && (
          // Full-width rows rather than the reference's centred pills: these
          // are whole questions, and four pills of four different widths
          // stacked up the middle of a phone screen is a ragged edge on both
          // sides. One column, one gutter, left-aligned like every other list
          // in the app.
          <div className="mt-3 space-y-2">
            {STARTERS.map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => void send(label)}
                disabled={busy}
                className="press glass-chip flex min-h-11 w-full items-center gap-3 rounded-full px-4 text-left text-[14px] font-medium text-foreground disabled:opacity-50"
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--color-muted-text)]" strokeWidth={1.75} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

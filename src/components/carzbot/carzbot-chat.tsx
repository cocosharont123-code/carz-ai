"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Gauge, Wrench, BadgeDollarSign, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";

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

  // Follow the conversation down. Behaviour, not layout: §1 allows this
  // because the browser does the scrolling, not a React state loop.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;

    const history = turns;
    const next: Turn[] = [...history, { role: "user", content: question }];
    setTurns(next);
    setValue("");
    setError("");
    setBusy(true);

    try {
      const res = await fetch("/api/carzbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = (await res.json().catch(() => null)) as
        | { reply?: string; error?: string }
        | null;

      if (!res.ok || !data?.reply) {
        /**
         * Put the thread back as it was.
         *
         * Every refusal this route gives -- not configured, not signed in, not
         * a member, too fast -- is a reason the question was never asked, so
         * leaving it on screen above an error reads as a question that was
         * answered badly. Rolling back restores the starters and puts the text
         * back in the box to send again.
         */
        setTurns(history);
        setValue(question);
        setError(data?.error || "CarzBot couldn't answer that one.");
        return;
      }

      setTurns([...next, { role: "assistant", content: data.reply }]);
    } catch {
      setTurns(history);
      setValue(question);
      setError("No connection to CarzBot. Check your network and try again.");
    } finally {
      setBusy(false);
    }
  }

  const empty = turns.length === 0;

  return (
    // The page's <main> is the scroller (§4). The composer sticks to its
    // bottom rather than the thread getting a scroller of its own.
    <div className="flex min-h-full flex-col px-5 pb-4">
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          <h1 className="display text-[34px] leading-tight">What can I tell you?</h1>
          <p className="mt-3 max-w-[18rem] text-[15px] leading-relaxed text-[var(--color-secondary-text)]">
            Specs, values, what to look for, how to tell two cars apart.
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-4 py-4">
          {turns.map((t, i) =>
            t.role === "user" ? (
              <p
                key={i}
                className="ml-auto max-w-[85%] rounded-card bg-carz px-4 py-2.5 text-[15px] leading-relaxed text-carz-ink"
              >
                {t.content}
              </p>
            ) : (
              <div key={i} className="glass-card max-w-[92%] space-y-3 rounded-card px-4 py-3">
                {t.content.split(/\n{2,}/).map((para, j) => (
                  <p key={j} className="text-[15px] leading-relaxed text-foreground">
                    {para}
                  </p>
                ))}
              </div>
            ),
          )}

          {busy && (
            <p role="status" aria-live="polite" className="text-[14px] text-[var(--color-secondary-text)]">
              CarzBot is thinking…
            </p>
          )}
          <div ref={endRef} />
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
      <div className="sticky bottom-0 pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(value);
          }}
          className="glass-card rounded-card"
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

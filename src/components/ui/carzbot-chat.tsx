"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/editorial";
import {
  ArrowUp as ArrowUpIcon,
  ChevronRight,
  ScanLine,
  Gauge,
  Wrench,
  CircleDollarSign,
  GitCompare,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Turn = {
  role: "user" | "assistant";
  content: string;
};

/** Openers. They ask the question rather than just naming a topic, because a
 *  chip that drops a bare noun into the box makes the reader write the rest. */
const PROMPTS = [
  { label: "What's it worth?", Icon: CircleDollarSign, prompt: "How do I work out what a used car is actually worth?" },
  { label: "Compare two cars", Icon: GitCompare, prompt: "Compare a Porsche 911 Carrera S and an Audi R8 V10 — which is the better daily driver?" },
  { label: "Common faults", Icon: Wrench, prompt: "What should I check before buying a used BMW M3?" },
  { label: "Fastest for the money", Icon: Gauge, prompt: "What's the fastest car I can buy for under $40,000?" },
  { label: "Tell two apart", Icon: ScanLine, prompt: "How do I tell a Carrera S apart from a base Carrera?" },
] as const;


/** Whether the browser can speak at all. */
function useAutoResizeTextarea({ minHeight, maxHeight }: { minHeight: number; maxHeight?: number }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = `${minHeight}px`;
      if (reset) return;
      textarea.style.height = `${Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      )}px`;
    },
    [minHeight, maxHeight],
  );

  return { textareaRef, adjustHeight };
}

export function CarzBotChat() {
  const [value, setValue] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 56, maxHeight: 160 });
  const threadRef = useRef<HTMLDivElement>(null);

  /**
   * How much of the screen the software keyboard is covering.
   *
   * `100dvh` does not shrink when the keyboard opens on iOS — the keyboard sits
   * over the visual viewport while the layout viewport stays the size it was.
   * So the column kept its full height, the composer ended up underneath the
   * keyboard, and Safari did the only thing left to it: scrolled the whole
   * document up to bring the focused field into view. That is the page sliding
   * away.
   *
   * Written straight to the element rather than held in state. visualViewport
   * fires continuously while a keyboard animates in and while the page settles,
   * and routing that through setState re-rendered the entire thread on every
   * one of those events — which is what made typing lag. A style write on one
   * node costs nothing and React never hears about it.
   */
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const shell = shellRef.current;
      if (!shell) return;
      const overlap = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      shell.style.height = `calc(100dvh - var(--nav-h) - var(--safe-top) - var(--back-h) - ${overlap}px)`;
      // The column just got shorter, which is exactly when the newest turn
      // would slide out of sight.
      const thread = threadRef.current;
      if (thread) thread.scrollTop = thread.scrollHeight;
      // Undo any shift Safari already applied before this ran.
      if (overlap > 0 && window.scrollY !== 0) window.scrollTo(0, 0);
    };
    // One write per frame at most, however many events arrive.
    const onChange = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
    return () => {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Keep the newest turn in view. A DOM write, not a state write, so it belongs
  // in an effect.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;

      // The history sent is the one on screen plus this question, rather than
      // state read back after setting it — setState is not immediate and the
      // request would go out a turn behind.
      const next: Turn[] = [...turns, { role: "user", content: question }];
      setTurns(next);
      setValue("");
      adjustHeight(true);
      setBusy(true);
      setError("");

      try {
        const res = await fetch("/api/carzbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: next }),
        });
        const d = await res.json().catch(() => null);
        if (!res.ok || !d?.reply) {
          // Put the thread back as it was.
          //
          // The question was added before the request went out, so a failure
          // left it on screen under an error with no answer coming — and,
          // because the thread was no longer empty, the suggested prompts
          // disappeared with it. On the first message that is the whole screen
          // gone: a dead question, an error, and nothing left to tap. Rolling
          // back restores the openers and puts the text back in the box to
          // send again.
          setTurns(turns);
          setValue(question);
          setError(d?.error || "CarzBot couldn't answer that.");
          return;
        }
        setTurns([...next, { role: "assistant", content: d.reply }]);
      } catch {
        setTurns(turns);
        setValue(question);
        setError("Network error — nothing was sent.");
      } finally {
        setBusy(false);
      }
    },
    [turns, busy, adjustHeight],
  );

  const empty = turns.length === 0;

  return (
    // Fills whatever the layout leaves, rather than measuring the viewport and
    // subtracting the furniture.
    //
    // It used to be 100dvh minus --nav-h, --safe-top and --back-h. That has to
    // agree with three separate variables and with the spacer the nav already
    // renders into this same column — and when any of them is wrong, or the
    // back button is not drawn, the composer is pushed off the bottom. The
    // column above is a flex column with min-h-100dvh, so flex-1 asks for "what
    // is left" and min-h-0 lets the thread inside actually scroll instead of
    // stretching its parent.
    <div ref={shellRef} className="flex min-h-0 flex-1 flex-col">
      <div
        ref={threadRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {empty ? (
          /* Was a 200px wave and a title centred in the full height of the
             pane, which on a phone is a screen of nothing with two faint dots
             in the middle. The prompts were a horizontal strip above the
             composer, so the one part worth tapping was the part hardest to
             see. They are the empty state now: full-width rows, in the space
             that was blank. */
          <div className="mt-auto pb-2">
            {/* No wave here. At the size this header allows it renders as six
                faint dots, which reads as a glitch rather than as the bot. */}
            <h1 className="display text-[28px] leading-none">CarzBot</h1>
            <p className="mt-1.5 text-[13px] text-[var(--color-secondary-text)]">
              Specs, prices, what a car is worth.
            </p>

            <div className="mt-5 space-y-2">
              {PROMPTS.map((pr) => (
                <button
                  key={pr.label}
                  type="button"
                  onClick={() => void ask(pr.prompt)}
                  className="press glass-card flex w-full items-center gap-3 rounded-card px-4 py-3 text-left"
                >
                  <pr.Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{pr.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 opacity-35" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-3 pt-4">
            {turns.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-card px-4 py-3 text-[14px] leading-relaxed",
                    t.role === "user"
                      ? "ml-auto bg-carz text-neutral-900"
                      : "glass-card",
                  )}
                >
                  {t.content}
                </div>
              ),
            )}
            {busy && (
              <div
                role="status"
                aria-live="polite"
                className="glass-card flex max-w-[85%] items-center gap-3 rounded-card px-4 py-3"
              >
                <Spinner className="h-5 w-5" />
                <span className="text-[14px] opacity-60">Thinking…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 24px, where the rest of the app uses 20.
      
          This started at 16 and went to 20 to match every other screen, which
          was right while the prompts were content-width chips. They are
          full-width rows now, and a row that runs the whole column reads much
          tighter at the same gutter than a chip that stops short of it — the
          edge of the card is the edge of the screen minus the gutter, every
          time, instead of only when a chip happens to reach that far.
      
          The thread above uses the same value so the rows, the bubbles and the
          composer all line up on one edge. */}
      <div className="shrink-0 px-6 pb-4">
        <div className="mx-auto w-full max-w-2xl">
          {error && (
            <p role="alert" className="mb-2 text-center text-[15px] text-neon-red">
              {error}
            </p>
          )}

          {/* Field and button on one row. Stacked, this was 118px tall — a
              56px minimum on the textarea and a 40px button under it — for a
              box that usually holds one line. */}
          <div className="glass-card flex items-end gap-2 rounded-card p-2">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(value);
                }
              }}
              placeholder="Ask about any car…"
              rows={1}
              className="max-h-32 min-h-10 w-full resize-none border-none bg-transparent px-2 py-2 text-[15px] shadow-none placeholder:text-[15px] focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ overflow: "hidden" }}
            />

            <button
              type="button"
              onClick={() => void ask(value)}
              disabled={busy || !value.trim()}
              aria-label="Send"
              className={cn(
                "press flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed",
                value.trim() && !busy
                  ? "bg-foreground text-background"
                  : "bg-foreground/[0.06] text-foreground/40",
              )}
            >
              <ArrowUpIcon className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

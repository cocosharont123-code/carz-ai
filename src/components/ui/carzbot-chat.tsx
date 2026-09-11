"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp as ArrowUpIcon,
  Volume2,
  VolumeX,
  ScanLine,
  Gauge,
  Wrench,
  CircleDollarSign,
  GitCompare,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { SiriWave } from "@/components/ui/siri-wave";
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

const VOICE_KEY = "carzbot_voice";

/** Whether the browser can speak at all. */
function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * An English voice, preferring one the platform calls high quality.
 *
 * getVoices() is empty until the list loads on some browsers, so this returns
 * null rather than waiting — an utterance with no voice set still speaks in the
 * system default, which is the right fallback.
 */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  return english.find((v) => /natural|premium|enhanced|siri/i.test(v.name)) ?? english[0] ?? null;
}

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
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 56, maxHeight: 160 });
  const threadRef = useRef<HTMLDivElement>(null);

  // Deferred a microtask: a synchronous state write in an effect body cascades
  // renders, which this project lints against.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => localStorage.getItem(VOICE_KEY) !== "0")
      .then((voice) => {
        if (cancelled) return;
        setVoiceOn(voice);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
      shell.style.height = `calc(100dvh - var(--topnav-h) - ${overlap}px)`;
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

  const stopSpeaking = useCallback(() => {
    if (canSpeak()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!canSpeak() || !text.trim()) return;
    // Anything still queued belongs to an older answer.
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? "en-US";
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }, []);

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;

      // The history sent is the one on screen plus this question, rather than
      // state read back after setting it — setState is not immediate and the
      // request would go out a turn behind.
      stopSpeaking(); // the previous answer is no longer the current one
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
        const d = await res.json();
        if (!res.ok || !d.reply) {
          setError(d.error || "CarzBot couldn't answer that.");
          return;
        }
        setTurns([...next, { role: "assistant", content: d.reply }]);
        // Every answer is written out now. It is still read aloud too when the
        // speaker is on, which is CarzBot talking rather than being talked to.
        if (voiceOn) speak(d.reply);
      } catch {
        setError("Network error — nothing was sent.");
      } finally {
        setBusy(false);
      }
    },
    [turns, busy, adjustHeight, voiceOn, speak, stopSpeaking],
  );

  // Never leave a voice talking after this goes.
  useEffect(() => () => {
    if (canSpeak()) window.speechSynthesis.cancel();
  }, []);

  const empty = turns.length === 0;

  return (
    // A fixed-height column, not a growing page: the thread scrolls inside its
    // own pane and the composer stays put. The page itself never scrolls, which
    // is what stops the input sliding away under your thumb mid-conversation.
    <div ref={shellRef} className="flex h-[calc(100dvh-var(--topnav-h))] flex-col">
      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            {/* The wave is the bot. It is the same thing that lights up while
                it listens and while it thinks, so the visual means something
                rather than sitting there as decoration. */}
            <SiriWave
              variant="fluid-dots"
              size={200}
              renderScale={0.5}
              className="bg-transparent"
            />
            <div>
              <h1 className="display text-4xl">CarzBot</h1>
              <p className="mt-1.5 text-[13px] opacity-60">Ask anything about cars.</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-3 pt-4">
            {turns.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    t.role === "user"
                      ? "ml-auto bg-white text-neutral-900"
                      : "glass-card",
                  )}
                >
                  {t.content}
                </div>
              ),
            )}
            {busy && (
              <div className="glass-card flex max-w-[85%] items-center gap-3 rounded-2xl px-4 py-3">
                <SiriWave variant="wave" size={44} renderScale={0.5} className="bg-transparent" />
                <span className="text-sm opacity-60">Thinking…</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pb-4">
        <div className="mx-auto w-full max-w-2xl">
          {error && (
            <p role="alert" className="mb-2 text-center text-[13px] text-neon-red">
              {error}
            </p>
          )}

          {empty && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => void ask(p.prompt)}
                  className="press glass-card flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold"
                >
                  <p.Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div className="glass-card rounded-3xl p-2">
            {speaking && (
              <div className="flex items-center gap-3 px-2 pb-1 pt-1">
                <SiriWave variant="wave" size={40} renderScale={0.5} className="bg-transparent" />
                <span className="util-label flex-1 opacity-60">Speaking…</span>
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="press util-label rounded-full bg-white/[0.08] px-3 py-1.5 hover:bg-white/[0.14]"
                >
                  Stop
                </button>
              </div>
            )}

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
              className="min-h-[56px] w-full resize-none border-none bg-transparent px-3 py-3 text-sm shadow-none placeholder:text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ overflow: "hidden" }}
            />

            <div className="flex items-center justify-end gap-2 px-2 pb-1">
              <button
                type="button"
                onClick={() => {
                  const next = !voiceOn;
                  setVoiceOn(next);
                  if (!next) stopSpeaking();
                  try {
                    localStorage.setItem(VOICE_KEY, next ? "1" : "0");
                  } catch {
                    /* a device that refuses storage still gets the toggle */
                  }
                }}
                aria-pressed={voiceOn}
                aria-label={voiceOn ? "Mute CarzBot" : "Let CarzBot speak"}
                className={cn(
                  "press flex h-10 w-10 items-center justify-center rounded-full transition-colors",
                  voiceOn ? "bg-white/[0.12]" : "bg-white/[0.06] text-white/40",
                )}
              >
                {voiceOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
              </button>

              <button
                type="button"
                onClick={() => void ask(value)}
                disabled={busy || !value.trim()}
                aria-label="Send"
                className={cn(
                  "press flex h-10 w-10 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed",
                  value.trim() && !busy
                    ? "bg-white text-neutral-900"
                    : "bg-white/[0.06] text-white/40",
                )}
              >
                <ArrowUpIcon className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

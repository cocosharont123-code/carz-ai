"use client";

import { useEffect, useRef, useCallback } from "react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
    // ArrowUp is aliased back to ArrowUpIcon: lucide 1.x dropped the `*Icon`
    // aliases, and importing the alias is a build error, not a missing glyph.
    ScanLine,
    Gauge,
    Wrench,
    CircleDollarSign,
    GitCompare,
    ArrowUp as ArrowUpIcon,
} from "lucide-react";

type Turn = { role: "user" | "assistant"; content: string };

/** Openers. They ask the question rather than just naming a topic, because a
 *  chip that drops a bare noun into the box makes the reader write the rest. */
const PROMPTS = [
    { label: "What's it worth?", Icon: CircleDollarSign, prompt: "How do I work out what a used car is actually worth?" },
    { label: "Compare two cars", Icon: GitCompare, prompt: "Compare a Porsche 911 Carrera S and an Audi R8 V10 — which is the better daily driver?" },
    { label: "Common faults", Icon: Wrench, prompt: "What should I check before buying a used BMW M3?" },
    { label: "Fastest for the money", Icon: Gauge, prompt: "What's the fastest car I can buy for under $40,000?" },
    { label: "Identify a car", Icon: ScanLine, prompt: "How do I tell a Carrera S apart from a base Carrera?" },
] as const;

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            // Temporarily shrink to get the right scrollHeight
            textarea.style.height = `${minHeight}px`;

            // Calculate new height
            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        // Set initial height
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    // Adjust height on window resize
    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

export function CarzBotChat() {
    const [value, setValue] = useState("");
    const [turns, setTurns] = useState<Turn[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 60,
        maxHeight: 200,
    });

    const ask = useCallback(
        async (text: string) => {
            const question = text.trim();
            if (!question || busy) return;

            // The history sent is the one on screen plus this question, rather
            // than state read back after setting it — setState is not immediate
            // and the request would go out a turn behind.
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
            } catch {
                setError("Network error — nothing was sent.");
            } finally {
                setBusy(false);
            }
        },
        [turns, busy, adjustHeight],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void ask(value);
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-4 space-y-8">
            {turns.length === 0 && (
                <h1 className="text-4xl font-bold text-white">Ask CarzBot</h1>
            )}

            {turns.length > 0 && (
                <div className="w-full space-y-3">
                    {turns.map((t, i) => (
                        <div
                            key={i}
                            className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                                t.role === "user"
                                    ? "ml-auto bg-white text-neutral-900"
                                    : "glass-card"
                            )}
                        >
                            {t.content}
                        </div>
                    ))}
                    {busy && (
                        <div className="glass-card max-w-[85%] rounded-2xl px-4 py-3 text-sm opacity-70">
                            Thinking…
                        </div>
                    )}
                </div>
            )}

            {error && (
                <p role="alert" className="w-full text-center text-[13px] text-neon-red">
                    {error}
                </p>
            )}

            <div className="w-full">
                <div className="relative bg-neutral-900 rounded-xl border border-neutral-800">
                    <div className="overflow-y-auto">
                        <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => {
                                setValue(e.target.value);
                                adjustHeight();
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about any car…"
                            className={cn(
                                "w-full px-4 py-3",
                                "resize-none",
                                "bg-transparent",
                                "border-none",
                                "text-white text-sm",
                                "focus:outline-none",
                                "focus-visible:ring-0 focus-visible:ring-offset-0",
                                "placeholder:text-neutral-500 placeholder:text-sm",
                                "min-h-[60px]"
                            )}
                            style={{
                                overflow: "hidden",
                            }}
                        />
                    </div>

                    {/* Attach and Project are gone with v0: one uploaded files
                        this has no use for, the other picked a project that does
                        not exist here. Both were inert. */}
                    <div className="flex items-center justify-end p-3">
                        <button
                            type="button"
                            onClick={() => void ask(value)}
                            disabled={busy || !value.trim()}
                            aria-label="Send"
                            className={cn(
                                "px-1.5 py-1.5 rounded-lg text-sm transition-colors border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800 flex items-center justify-between gap-1 disabled:cursor-not-allowed",
                                value.trim() && !busy
                                    ? "bg-white text-black"
                                    : "text-zinc-400"
                            )}
                        >
                            <ArrowUpIcon
                                className={cn(
                                    "w-4 h-4",
                                    value.trim() && !busy ? "text-black" : "text-zinc-400"
                                )}
                            />
                            <span className="sr-only">Send</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    {PROMPTS.map((p) => (
                        <ActionButton
                            key={p.label}
                            icon={<p.Icon className="w-4 h-4" />}
                            label={p.label}
                            onClick={() => ask(p.prompt)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

interface ActionButtonProps {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
}

function ActionButton({ icon, label, onClick }: ActionButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 rounded-full border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
            {icon}
            <span className="text-xs">{label}</span>
        </button>
    );
}

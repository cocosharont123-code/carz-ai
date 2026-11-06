"use client";

import MorphOrb from "@/components/ui/ai-thinking-orb-and-input";

/**
 * CarzBot, as the orb.
 *
 * The only thing this adds to the component is where the answer comes from.
 * /api/carzbot takes a transcript and returns one reply, so a single turn is
 * sent: the orb is one question and one answer by design -- it resolves into a
 * card and offers to start again, with nowhere to put a thread.
 *
 * Every refusal the route can give -- not configured, not signed in, not a
 * member, rate limited -- comes back as the answer text rather than as a thrown
 * error. The orb has one place to say things, and "CarzBot is a Carz PRO
 * feature" is the useful thing to say there. A thrown error would show the
 * component's own fallback instead, which says nothing.
 */
async function ask(text: string): Promise<string> {
  try {
    const res = await fetch("/api/carzbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
    });
    const data = (await res.json().catch(() => null)) as
      | { reply?: string; error?: string }
      | null;
    if (data?.reply?.trim()) return data.reply;
    if (data?.error) return data.error;
    return "CarzBot couldn't answer that one. Try again in a moment.";
  } catch {
    return "No connection to CarzBot. Check your network and try again.";
  }
}

export function CarzBotOrb() {
  return <MorphOrb onSubmit={ask} />;
}

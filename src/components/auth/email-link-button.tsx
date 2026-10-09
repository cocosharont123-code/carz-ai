"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Spinner } from "@/components/ui/editorial";

/**
 * The route that does not need a Google account.
 *
 * Step one already collected the address, so this asks for nothing further —
 * it posts, and the next thing that happens is in the inbox.
 */
export function EmailLinkButton({ email, callbackUrl }: { email: string; callbackUrl: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function send() {
    setState("sending");
    setMessage("");
    try {
      const res = await fetch("/api/auth/email-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, callbackUrl }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.ok) {
        setState("sent");
        return;
      }
      setState("error");
      setMessage(
        d?.error === "not_configured"
          ? "Email sign-in isn't switched on yet. Use Google for now."
          : "We couldn't send that. Try again in a moment.",
      );
    } catch {
      setState("error");
      setMessage("We couldn't reach the server. Try again in a moment.");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" aria-live="polite" className="rounded-card glass-chip p-4">
        <p className="text-[15px] font-semibold">Check your inbox</p>
        <p className="mt-1 text-[13px] leading-relaxed opacity-65">
          We sent a sign-in link to {email}. It works once and expires in 15 minutes.
        </p>
        <button
          type="button"
          onClick={send}
          className="press mt-3 h-11 text-[13px] font-semibold text-carz underline underline-offset-4"
        >
          Send it again
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={send}
        disabled={state === "sending"}
        className="press glass-card inline-flex h-12 w-full items-center justify-center gap-3 rounded-full px-6 text-[14px] font-semibold transition-colors hover:bg-foreground/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state === "sending" ? (
          <Spinner className="h-[18px] w-[18px]" />
        ) : (
          <Mail className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
        )}
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state === "error" && (
        <p role="alert" className="mt-2 text-[12px] leading-snug text-neon-red">
          {message}
        </p>
      )}
    </>
  );
}

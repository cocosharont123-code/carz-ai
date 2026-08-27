"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Share a post.
 *
 * Uses the native share sheet where there is one — that's phones, which is
 * where a car feed gets used — and falls back to copying the link. The fallback
 * matters: `navigator.share` is absent on most desktop browsers, and a share
 * button that silently does nothing is worse than no button.
 */
export function ShareButton({
  postId,
  caption,
  className,
}: {
  postId: string;
  caption?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    // Built at click time: the component may render server-side first, where
    // window doesn't exist.
    const url = `${window.location.origin}/feed/${postId}`;
    const title = "Carz AI";
    const text = caption?.trim() ? caption.trim().slice(0, 120) : "Seen on the Carz feed";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // Dismissing the sheet rejects too, so fall through to copying rather
        // than treating it as a failure worth reporting.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure origin, permissions) — prompt() at least
      // puts the link somewhere it can be selected by hand.
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share this post"
      className={cn(
        "press inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] px-3 py-1.5 text-[13px] font-semibold transition hover:bg-black/[0.1]",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          Share
        </>
      )}
    </button>
  );
}

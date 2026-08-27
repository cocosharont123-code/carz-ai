"use client";

import { useEffect, useState } from "react";
import { TermsReader } from "@/components/terms-reader";
import { TERMS_VERSION, TERMS_ENTITY } from "@/lib/terms";
import { hasAcceptedCurrent } from "@/lib/terms-acceptance";

type Status = "checking" | "blocked" | "accepted";

/**
 * Blocks the entire app until the Terms are accepted.
 *
 * Acceptance lives in localStorage, which the server can't read, so the first
 * render can't know the answer. It renders nothing until the check completes
 * rather than guessing: guessing "accepted" would flash the app to someone who
 * hasn't agreed, and guessing "blocked" would flash the wall at everyone who has.
 *
 * The gate replaces the app rather than overlaying it — nothing behind it is
 * mounted, so there is no page to tab into, no scroll position to reach, and no
 * request fired by a page the user hasn't been cleared to see.
 */
export function TermsGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    // Read in a callback: localStorage is the external system being synced
    // from, and it doesn't exist during the server render.
    Promise.resolve(hasAcceptedCurrent()).then((ok) =>
      setStatus(ok ? "accepted" : "blocked"),
    );
  }, []);

  if (status === "checking") {
    // Deliberately blank. A spinner here would flash on every navigation for
    // the overwhelming majority who have already accepted.
    return <div className="min-h-dvh bg-background" aria-hidden />;
  }

  if (status === "accepted") return <>{children}</>;

  return (
    <div className="min-h-dvh overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-carz" />
          <span className="wordmark text-2xl leading-none">Carz AI</span>
        </div>

        <h1 className="display mt-6 text-center text-4xl">Before you start</h1>
        <p className="mx-auto mt-3 max-w-md text-center text-[13px] leading-relaxed opacity-70">
          Read and accept the Terms of Service to use Carz AI. You&apos;ll need to scroll to the
          end — the whole document, including the safety and auction terms.
        </p>

        <div className="mt-6">
          <TermsReader
            paneHeightClass="h-[52dvh]"
            onAccepted={() => setStatus("accepted")}
          />
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-wide opacity-40">
          {TERMS_ENTITY} · version {TERMS_VERSION}
        </p>
      </div>
    </div>
  );
}

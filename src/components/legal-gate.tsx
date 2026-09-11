"use client";

import { useEffect, useState } from "react";
import { TermsReader } from "@/components/terms-reader";
import { PrivacyReader } from "@/components/privacy-reader";
import { TERMS_VERSION, TERMS_ENTITY } from "@/lib/terms";
import { PRIVACY_VERSION, PRIVACY_ENTITY } from "@/lib/privacy";
import { hasAcceptedCurrent } from "@/lib/terms-acceptance";
import { hasAcceptedPrivacy } from "@/lib/privacy-acceptance";

type Status = "checking" | "terms" | "privacy" | "cleared";

/**
 * Blocks the entire app until both the Terms and the Privacy Policy are
 * accepted.
 *
 * Acceptance lives in localStorage, which the server can't read, so the first
 * render can't know the answer. It renders nothing until the check completes
 * rather than guessing: guessing "accepted" would flash the app to someone who
 * hasn't agreed, and guessing "blocked" would flash the wall at everyone who has.
 *
 * The gate replaces the app rather than overlaying it, so nothing behind it is
 * mounted: there is no page to tab into, no scroll position to reach, and no
 * request fired by a page the user hasn't been cleared to see.
 *
 * The two documents are taken one after the other and recorded separately, so
 * revising one doesn't discard the acceptance already given for the other.
 */
export function LegalGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    // Read in a callback: localStorage is the external system being synced
    // from, and it doesn't exist during the server render.
    Promise.resolve(next()).then(setStatus);
  }, []);

  if (status === "checking") {
    // Deliberately blank. A spinner here would flash on every navigation for
    // the overwhelming majority who have already accepted.
    return <div className="min-h-dvh bg-background" aria-hidden />;
  }

  if (status === "cleared") return <>{children}</>;

  const onTerms = status === "terms";

  return (
    <div className="min-h-dvh overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-2xl px-5 py-10">
        <div className="flex items-center justify-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-carz" />
          <span className="wordmark text-2xl leading-none">Carz AI</span>
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-wide opacity-40">
          Step {onTerms ? 1 : 2} of 2
        </p>
        <h1 className="display mt-1 text-center text-4xl">
          {onTerms ? "Before you start" : "One more thing"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-center text-[13px] leading-relaxed opacity-70">
          {onTerms ? (
            <>
              Read and accept the Terms of Service to use Carz AI. You&apos;ll need to scroll to
              the end — the whole document, including the safety and auction terms.
            </>
          ) : (
            <>
              Now read and accept the Privacy Policy. It covers what we collect, who it goes to,
              and the rule that you must be 18 or older to use Carz AI.
            </>
          )}
        </p>

        <div className="mt-6">
          {onTerms ? (
            <TermsReader
              paneHeightClass="h-[52dvh]"
              // Not straight to the app: the Privacy Policy may still be
              // outstanding, so re-ask which document is next.
              onAccepted={() => setStatus(next())}
            />
          ) : (
            <PrivacyReader paneHeightClass="h-[52dvh]" onAccepted={() => setStatus(next())} />
          )}
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-wide opacity-40">
          {onTerms ? (
            <>
              {TERMS_ENTITY} · version {TERMS_VERSION}
            </>
          ) : (
            <>
              {PRIVACY_ENTITY} · version {PRIVACY_VERSION}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/** The first document still outstanding, or "cleared" when both are done. */
function next(): Status {
  if (!hasAcceptedCurrent()) return "terms";
  if (!hasAcceptedPrivacy()) return "privacy";
  return "cleared";
}

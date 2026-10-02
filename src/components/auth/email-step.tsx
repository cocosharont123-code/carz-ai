"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

/**
 * The email field on step one.
 *
 * The email is not a formality collected to make the flow feel longer. It is
 * handed to Google as login_hint on step two, which is what opens the account
 * chooser on that account rather than on whichever one the browser happens to be
 * holding. On a shared phone that is the difference between signing in and
 * signing in as somebody else.
 *
 * It travels to step two in the query string. That puts it in history, which for
 * a person's own address on their own device buys a step two that survives a
 * refresh and the back button.
 */

/**
 * Deliberately loose. The authority on whether an address exists is Google, one
 * step later; all this has to catch is the typo that would send someone there
 * with nothing useful in hand, and a stricter pattern only ever rejects real
 * addresses.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function EmailStep({
  callbackUrl,
  initialEmail,
  authEnabled,
}: {
  callbackUrl: string;
  initialEmail: string;
  /**
   * Whether there is anything to sign in with, decided on the server.
   *
   * This used to be a fetch to /api/me. Then the wall went up and /api/me went
   * behind it, so the one screen that has to work without a session was asking a
   * question only a signed-in caller could get an answer to: the fetch came back
   * 401, the catch set this false, and the Continue button disabled itself for
   * everybody. The page is server-rendered and the answer is an environment
   * variable, so it arrives as a prop with no round trip and nothing to fail.
   */
  authEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);

  // Prefetched on mount rather than on submit: step two is a route, and a step
  // that waits for a chunk to download before it appears reads as one that
  // failed.
  useEffect(() => {
    router.prefetch("/signin/continue");
  }, [router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!LOOKS_LIKE_EMAIL.test(trimmed)) {
      setError("That doesn't look like an email address.");
      return;
    }
    router.push(`/signin/continue?${new URLSearchParams({ email: trimmed, callbackUrl })}`);
  };

  return (
    <>
      {/* A real form, so Enter submits because that is what Enter does in a
          form — not because a keydown handler was written to imitate it. Which
          also means Go on the iOS keyboard works and password managers see a
          field they recognise. */}
      <form onSubmit={submit} noValidate>
        {/* Label above the field, not inside it. A placeholder disappears the
            moment someone starts typing, which is the moment they most need to
            know what they are filling in. */}
        <label htmlFor="email" className="util-label block opacity-60">
          Email
        </label>

        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            // Cleared the moment they start fixing it. Holding the message up
            // while someone is visibly correcting it is just scolding.
            if (error) setError(null);
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "email-error" : undefined}
          placeholder="you@example.com"
          className="mt-2 h-12 w-full rounded-card border border-[var(--line-card)] bg-white/[0.06] px-4 text-[17px] outline-none transition placeholder:opacity-35 focus:border-carz/60 focus:bg-white/[0.08]"
        />

        {/* Held open whether or not it is filled, so the button does not jump
            out from under a thumb when the message appears. */}
        <div className="min-h-[1.25rem] pt-1.5">
          {error && (
            <p id="email-error" role="alert" className="text-[12px] leading-snug text-neon-red">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!authEnabled}
          className="press mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-card bg-carz text-[15px] font-semibold text-carz-ink transition disabled:opacity-40"
        >
          Continue
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
        </button>
      </form>

      {!authEnabled && (
        <p role="status" className="mt-4 text-[15px] leading-snug opacity-70">
          Sign-in is being set up and isn&apos;t available just yet.
        </p>
      )}
    </>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GoogleSignInButton } from "@/components/google-sign-in";

/**
 * Sign in.
 *
 * Sized to the space that is actually free rather than to the viewport. The
 * page sits inside a column that already carries the status-bar inset above it
 * and the nav's spacer below, so a min-h-screen here was a full viewport plus
 * both of those — taller than the screen by exactly the furniture around it,
 * which is the scroll to nowhere.
 */
const FRAME_H = "min-h-[calc(100dvh-var(--nav-h)-var(--safe-top))]";

function SignInInner() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/spot";
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setAuthEnabled(!!d.authEnabled))
      .catch(() => setAuthEnabled(false));
  }, []);

  return (
    <main
      className={`flex ${FRAME_H} w-full flex-col items-center justify-center px-5 text-center`}
    >
      {/* .display is the home page's headline face and is uppercase in the
          class itself, so the markup stays sentence case and the screen still
          reads SIGN IN. */}
      <h1 className="display text-6xl leading-[0.95] sm:text-7xl">Sign in</h1>

      <p className="mx-auto mt-4 max-w-xs text-[13px] leading-relaxed opacity-60">
        Your garage, your streak and your place on the leaderboard follow your
        account.
      </p>

      <div className="mt-9 w-full max-w-[17rem]">
        <GoogleSignInButton
          variant="squircle"
          callbackUrl={callbackUrl}
          disabled={authEnabled === false}
        />

        {/* Reserved whether or not it is showing, so the button does not jump
            down the screen when the check comes back. */}
        <div className="mt-4 min-h-[3.25rem]">
          {authEnabled === false && (
            <p
              role="status"
              className="glass-card rounded-2xl px-4 py-3 text-[13px] leading-snug"
            >
              Sign-in is being set up and isn&apos;t available just yet.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className={FRAME_H} />}>
      <SignInInner />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/site-header";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

function SignInInner() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/pricing";
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setAuthEnabled(!!d.authEnabled))
      .catch(() => setAuthEnabled(false));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-20 text-center">
      <span className="inline-block h-12 w-12 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Sign in to Car Spotter</h1>
      <p className="mt-2 text-muted-foreground">
        Sign in or create an account to subscribe and unlock Pro & Max.
      </p>

      {authEnabled === false && (
        <div className="mt-6 w-full rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Sign-in is being set up and isn&apos;t available just yet. Check back soon.
        </div>
      )}

      <div className="mt-8 w-full space-y-3">
        <button
          onClick={() => signIn("google", { callbackUrl })}
          disabled={authEnabled !== true}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-[#1f1f1f] transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <button
          disabled
          title="Apple sign-in is coming soon"
          className="flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-semibold text-muted-foreground"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.37 12.6c-.02-2.27 1.85-3.36 1.94-3.41-1.06-1.55-2.71-1.76-3.29-1.78-1.4-.14-2.73.82-3.44.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.88-3.71 2.24-1.58 2.74-.4 6.8 1.13 9.02.75 1.09 1.64 2.31 2.81 2.27 1.13-.05 1.55-.73 2.92-.73 1.36 0 1.75.73 2.94.71 1.21-.02 1.98-1.11 2.72-2.21.86-1.27 1.21-2.5 1.23-2.56-.03-.01-2.36-.91-2.38-3.6ZM14.1 5.62c.62-.76 1.04-1.8.93-2.85-.9.04-1.99.6-2.63 1.35-.57.67-1.08 1.74-.94 2.76.99.08 2.01-.5 2.64-1.26Z" />
          </svg>
          Continue with Apple
          <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold">SOON</span>
        </button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        New here? Continuing with Google creates your account automatically.
      </p>
    </main>
  );
}

export default function SignInPage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<div className="flex-1" />}>
        <SignInInner />
      </Suspense>
    </>
  );
}

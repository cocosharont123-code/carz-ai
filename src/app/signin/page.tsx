"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
  const callbackUrl = params.get("callbackUrl") || "/spot";
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setAuthEnabled(!!d.authEnabled))
      .catch(() => setAuthEnabled(false));
  }, []);

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center px-5 text-center">
      <Link href="/" className="flex items-center gap-3">
        <span className="inline-block h-5 w-5 bg-carz" />
        <span className="wordmark text-4xl">Carz AI</span>
      </Link>

      {authEnabled === false && (
        <div className="mt-8 max-w-xs border border-carz/40 bg-carz/10 p-3 text-sm ">
          Sign-in is being set up and isn&apos;t available just yet. Check back soon.
        </div>
      )}

      <button
        onClick={() => signIn("google", { callbackUrl })}
        disabled={authEnabled !== true}
        className="mt-10 flex w-full max-w-xs items-center justify-center gap-3 bg-white px-4 py-3.5 font-semibold text-[#1f1f1f] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <GoogleIcon />
        Continue with Google
      </button>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignInInner />
    </Suspense>
  );
}

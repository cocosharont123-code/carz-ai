"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GoogleSignInButton } from "@/components/google-sign-in";

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

      <GoogleSignInButton callbackUrl={callbackUrl} full className="max-w-xs" />
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

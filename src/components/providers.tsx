"use client";

import { SessionProvider } from "next-auth/react";
import { RevealObserver } from "@/components/reveal-observer";
import { TermsGate } from "@/components/terms-gate";

// No profile gate: signing in provisions a profile with a generated name, so
// there is nothing to redirect anyone to.
//
// The Terms gate sits inside SessionProvider but outside every page, so it
// covers the whole app — including any route added later — without each page
// having to remember to check.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RevealObserver />
      <TermsGate>{children}</TermsGate>
    </SessionProvider>
  );
}

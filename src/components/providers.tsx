"use client";

import { SessionProvider } from "next-auth/react";
import { RevealObserver } from "@/components/reveal-observer";
import { LegalGate } from "@/components/legal-gate";

// No profile gate: signing in provisions a profile with a generated name, so
// there is nothing to redirect anyone to.
//
// The legal gate sits inside SessionProvider but outside every page, so the
// Terms and the Privacy Policy cover the whole app — including any route added
// later — without each page having to remember to check.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RevealObserver />
      <LegalGate>{children}</LegalGate>
    </SessionProvider>
  );
}

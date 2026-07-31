"use client";

import { SessionProvider } from "next-auth/react";
import { RevealObserver } from "@/components/reveal-observer";

// No profile gate: signing in provisions a profile with a generated name, so
// there is nothing to redirect anyone to.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RevealObserver />
      {children}
    </SessionProvider>
  );
}

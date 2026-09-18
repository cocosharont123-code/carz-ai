"use client";

import { SessionProvider } from "next-auth/react";
import { RevealObserver } from "@/components/reveal-observer";

// No profile gate: signing in provisions a profile with a generated name, so
// there is nothing to redirect anyone to.
//
// No legal gate either any more. The Terms and the Privacy Policy used to
// block the entire app until both had been scrolled to the end and accepted;
// they now bind by use, and the layout carries a line under every page saying
// so. See LegalNotice for what that trades away.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RevealObserver />
      {children}
    </SessionProvider>
  );
}

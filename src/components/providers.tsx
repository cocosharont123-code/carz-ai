"use client";

import { SessionProvider } from "next-auth/react";
import { ProfileGate } from "@/components/profile-gate";
import { RevealObserver } from "@/components/reveal-observer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProfileGate />
      <RevealObserver />
      {children}
    </SessionProvider>
  );
}

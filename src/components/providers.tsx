"use client";

import { SessionProvider } from "next-auth/react";
import { ProfileGate } from "@/components/profile-gate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ProfileGate />
      {children}
    </SessionProvider>
  );
}

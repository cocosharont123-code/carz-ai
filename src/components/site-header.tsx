"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

type Status = { planName: string; plan: string };

export function SiteHeader() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  const badgeClass =
    status?.plan === "max"
      ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
      : status?.plan === "pro"
        ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
        : "border-border bg-card text-muted-foreground";

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.04] bg-background/30 px-5 py-3 backdrop-blur-xl">
      <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
        <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
        Car Spotter
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        {status && (
          <span className={`hidden rounded-full border px-3 py-1 text-xs font-semibold sm:inline ${badgeClass}`}>
            {status.planName}
            {status.plan === "max" ? " ⚡" : ""}
          </span>
        )}
        <Link href="/spot" className="text-foreground/80 hover:text-foreground">
          Spot
        </Link>
        <Link href="/pricing" className="text-foreground/80 hover:text-foreground">
          Plans
        </Link>
        <Link
          href="/assistant"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3.5 py-1.5 font-semibold text-foreground transition hover:border-white/25 hover:bg-white/[0.12]"
        >
          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          Assistant
        </Link>
      </nav>
    </header>
  );
}

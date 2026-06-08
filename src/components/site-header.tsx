"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";

type Status = { planName: string; plan: string };

export function SiteHeader() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setUsername(null);
      return;
    }
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setUsername(d.profile?.username ?? ""))
      .catch(() => {});
  }, [session]);

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
        <ThemeToggle />
        {status && (
          <span className={`hidden rounded-full border px-3 py-1 text-xs font-semibold sm:inline ${badgeClass}`}>
            {status.planName}
            {status.plan === "max" ? " ⚡" : ""}
          </span>
        )}
        <Link href="/spot" className="text-foreground/80 hover:text-foreground">
          Spot
        </Link>
        <Link href="/feed" className="text-foreground/80 hover:text-foreground">
          Feed
        </Link>
        <Link href="/garage" className="hidden text-foreground/80 hover:text-foreground sm:inline">
          Garage
        </Link>
        <Link href="/leaderboard" className="hidden text-foreground/80 hover:text-foreground sm:inline">
          Ranks
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
        {session?.user ? (
          <>
            <Link
              href="/profile"
              className="font-semibold text-foreground/90 hover:text-foreground"
              title="Edit profile"
            >
              {username ? `@${username}` : "Set username"}
            </Link>
            <button
              onClick={() => signOut()}
              className="hidden text-foreground/60 hover:text-foreground sm:inline"
            >
              Sign out
            </button>
          </>
        ) : (
          <Link href="/signin" className="text-foreground/80 hover:text-foreground">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

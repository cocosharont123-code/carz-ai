"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Avatar } from "@/components/default-avatar";

export function SiteHeader() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<{ username: string; image: string } | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfile(d.profile ?? null))
      .catch(() => {});
  }, [session]);

  return (
    <header className="sticky top-0 z-50 flex items-start justify-between gap-3 border-b border-foreground/[0.04] bg-background/30 px-5 py-3 backdrop-blur-xl">
      {/* Logo + (mobile-only) account line beneath it */}
      <div className="flex shrink-0 flex-col gap-1">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
          Car Spotter
        </Link>

        {/* Account / username setup — shown under the logo on mobile only */}
        {session?.user ? (
          <div className="flex items-center gap-2 text-xs sm:hidden">
            <Link
              href="/profile"
              className="flex items-center gap-1.5 font-semibold text-foreground/90 hover:text-foreground"
            >
              <Avatar src={profile?.image} size={20} />
              {profile?.username ? `@${profile.username}` : "Set username →"}
            </Link>
            <button
              onClick={() => signOut()}
              className="text-foreground/50 hover:text-foreground"
            >
              · Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/signin"
            className="text-xs font-semibold text-foreground/80 hover:text-foreground sm:hidden"
          >
            Sign in / create account →
          </Link>
        )}
      </div>

      <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5 text-sm">
        <Link href="/spot" className="text-foreground/80 hover:text-foreground">
          Spot
        </Link>
        <Link href="/auctions" className="text-foreground/80 hover:text-foreground">
          Auctions
        </Link>
        <Link href="/garage" className="text-foreground/80 hover:text-foreground">
          Garage
        </Link>
        <Link href="/leaderboard" className="text-foreground/80 hover:text-foreground">
          Ranks
        </Link>
        <Link
          href="/assistant"
          className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/[0.06] px-3.5 py-1.5 font-semibold text-foreground transition hover:border-foreground/25 hover:bg-foreground/[0.12]"
        >
          <Sparkles className="h-3.5 w-3.5 text-violet-300" />
          Assistant
        </Link>

        {/* Account — shown in the nav on desktop only (it's under the logo on mobile) */}
        {session?.user ? (
          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href="/profile"
              title={profile?.username ? `@${profile.username} — edit profile` : "Set up your profile"}
              className="flex items-center gap-2 hover:opacity-90"
            >
              <Avatar src={profile?.image} size={30} />
              <span className="font-semibold text-foreground/90">
                {profile?.username ? `@${profile.username}` : "Set username"}
              </span>
            </Link>
            <button
              onClick={() => signOut()}
              className="text-foreground/60 hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/signin" className="hidden text-foreground/80 hover:text-foreground sm:inline">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

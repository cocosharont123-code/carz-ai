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
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-foreground/[0.04] bg-background/30 px-5 py-3 backdrop-blur-xl">
      <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
        <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
        Car Spotter
      </Link>
      <nav className="flex items-center gap-3 text-sm">
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
        {session?.user ? (
          <>
            <Link
              href="/profile"
              title={profile?.username ? `@${profile.username} — edit profile` : "Set up your profile"}
              className="flex items-center gap-2 hover:opacity-90"
            >
              <Avatar src={profile?.image} size={30} />
              <span className="hidden font-semibold text-foreground/90 sm:inline">
                {profile?.username ? `@${profile.username}` : "Set username"}
              </span>
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

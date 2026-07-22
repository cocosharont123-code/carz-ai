"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Avatar } from "@/components/default-avatar";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/spot", label: "Spot" },
  { href: "/auctions", label: "Auctions" },
  { href: "/hunt", label: "Hunt", accent: true },
  { href: "/garage", label: "Garage" },
  { href: "/leaderboard", label: "Ranks" },
  { href: "/assistant", label: "Assistant" },
];

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
    <header className="sticky top-0 z-50 flex items-start justify-between gap-3 border-b border-white/10 bg-black/80 px-5 py-3.5">
      <div className="flex shrink-0 flex-col gap-1.5">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-block h-3.5 w-3.5 bg-carz" />
          <span className="display text-xl leading-none">Carz AI</span>
        </Link>

        {/* Mobile-only account under the wordmark */}
        {session?.user ? (
          <div className="flex items-center gap-2 sm:hidden">
            <Link href="/profile" className="flex items-center gap-1.5">
              <Avatar src={profile?.image} size={20} />
              <span className="util-label text-nblue">
                {profile?.username ? `@${profile.username}` : "Set username →"}
              </span>
            </Link>
            <button onClick={() => signOut()} className="util-label text-ngreen hover:text-carz">
              · Out
            </button>
          </div>
        ) : (
          <Link href="/signin" className="util-label text-nred hover:text-carz sm:hidden">
            Sign in →
          </Link>
        )}
      </div>

      <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "util-label transition-colors",
              n.accent ? "text-carz hover:brightness-110" : "text-nred hover:text-nblue",
            )}
          >
            {n.label}
          </Link>
        ))}

        {session?.user ? (
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/profile" className="flex items-center gap-2 hover:opacity-90">
              <Avatar src={profile?.image} size={26} />
              <span className="util-label text-nblue">
                {profile?.username ? `@${profile.username}` : "Set username"}
              </span>
            </Link>
            <button onClick={() => signOut()} className="util-label text-ngreen hover:text-carz">
              Out
            </button>
          </div>
        ) : (
          <Link href="/signin" className="util-label hidden text-nred hover:text-carz sm:inline">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}

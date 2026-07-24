"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Avatar } from "@/components/default-avatar";
import { cn } from "@/lib/utils";

// Split nav: Hunt / Assistant / Carz+ on the left, everything else on the right.
const LEFT_NAV = [
  { href: "/hunt", label: "Hunt", accent: true },
  { href: "/assistant", label: "Assistant" },
  { href: "/pricing", label: "Carz+", accent: true },
];
const RIGHT_NAV = [
  { href: "/spot", label: "Spot" },
  { href: "/auctions", label: "Auctions" },
  { href: "/events", label: "Events" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/garage", label: "Garage" },
  { href: "/leaderboard", label: "Ranks" },
];

function NavLink({ href, label, accent }: { href: string; label: string; accent?: boolean }) {
  return (
    <Link
      href={href}
      className={cn("util-label whitespace-nowrap transition-colors", accent ? "text-carz hover:brightness-110" : "hover:text-white")}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<{ username: string; image: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const account = session?.user ? (
    <div className="flex items-center gap-2">
      <Link href="/profile" title="Profile" className="press flex items-center gap-1.5 hover:opacity-90">
        <Avatar src={profile?.image} size={24} />
        <span className="util-label hidden sm:inline">
          {profile?.username ? `@${profile.username}` : "Set username"}
        </span>
      </Link>
      <button onClick={() => signOut()} className="util-label hidden hover:text-white sm:inline">
        Out
      </button>
    </div>
  ) : (
    <Link href="/signin" className="util-label whitespace-nowrap hover:text-white">
      Sign in
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black text-white shadow-[0_1px_0_rgba(255,255,255,0.06),0_12px_30px_-12px_rgba(0,0,0,0.9)]">
      {/* Desktop: left nav / centered wordmark / right nav + account */}
      <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3.5 sm:grid">
        <nav className="flex flex-wrap items-center justify-start gap-x-4 gap-y-1.5">
          {LEFT_NAV.map((n) => (
            <NavLink key={n.href} {...n} />
          ))}
        </nav>

        <Link href="/" className="press flex items-center justify-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-carz" />
          <span className="wordmark whitespace-nowrap text-2xl leading-none">Carz AI</span>
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1.5">
          {RIGHT_NAV.map((n) => (
            <NavLink key={n.href} {...n} />
          ))}
          {account}
        </nav>
      </div>

      {/* Mobile: hamburger + wordmark + account, links behind a dropdown menu */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="press flex h-8 w-8 flex-col items-center justify-center gap-[5px] hover:text-white"
          >
            <span className={cn("block h-0.5 w-5 bg-current transition-transform", menuOpen && "translate-y-[7px] rotate-45")} />
            <span className={cn("block h-0.5 w-5 bg-current transition-opacity", menuOpen && "opacity-0")} />
            <span className={cn("block h-0.5 w-5 bg-current transition-transform", menuOpen && "-translate-y-[7px] -rotate-45")} />
          </button>

          <Link href="/" className="press flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <span className="inline-block h-3 w-3 rounded-full bg-carz" />
            <span className="wordmark whitespace-nowrap text-xl leading-none">Carz AI</span>
          </Link>

          {account}
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-y-3 border-t border-white/10 px-4 py-4">
            {[...LEFT_NAV, ...RIGHT_NAV].map((n) => (
              <span key={n.href} onClick={() => setMenuOpen(false)}>
                <NavLink {...n} />
              </span>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

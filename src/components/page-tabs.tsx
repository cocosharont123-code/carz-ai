"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Grouped sections that share a page with a tab switcher:
// Hunt + Events, Auctions + Wishlist, Garage + Ranks.
const GROUPS = {
  hunt: [
    { href: "/hunt", label: "Hunt" },
    { href: "/events", label: "Events" },
  ],
  auctions: [
    { href: "/auctions", label: "Auctions" },
    { href: "/wishlist", label: "Wishlist" },
  ],
  collection: [
    { href: "/garage", label: "Garage" },
    { href: "/leaderboard", label: "Ranks" },
  ],
} as const;

export function PageTabs({ group }: { group: keyof typeof GROUPS }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto flex w-full max-w-6xl justify-center px-5 pt-5">
      <nav className="inline-flex gap-1 rounded-full border border-white/12 bg-white/[0.03] p-1">
        {GROUPS[group].map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "util-label whitespace-nowrap rounded-full px-5 py-1.5 transition-colors",
                active ? "bg-carz text-black" : "opacity-70 hover:opacity-100",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

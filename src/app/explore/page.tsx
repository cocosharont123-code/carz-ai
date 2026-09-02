"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  EXPLORE_BUBBLES,
  EXPLORE_COPY,
  matchesExploreQuery,
  type ExploreItem,
} from "@/config/explore";

/**
 * The front door: the whole app on one screen as a grid of squircles.
 *
 * This is where the app opens, so it carries no site header. The bubbles are
 * the navigation — a menu bar above them would be a second, smaller copy of
 * the same thing, and the hamburger is the exact gesture this page exists to
 * make unnecessary. Every page a bubble leads to still has the header, with an
 * Explore link in it to come back.
 *
 * Everything above the grid is one wordmark and one line, because a stack of
 * headings is space spent before anything is tappable. Below it there is
 * nothing: account and legal reach the user through the header that every
 * other page carries, so repeating them here only added a tail to scroll past.
 *
 * All copy lives in src/config/explore.ts.
 */

function Bubble({ item }: { item: ExploreItem }) {
  const Icon = item.icon;
  return (
    <div className="flex flex-col items-center">
      <Link
        href={item.href}
        // A squircle, not a circle: the same app-icon shape the phone's own
        // home screen uses, and it gives the label its corners back.
        // 4:3 rather than square — full width, but shorter, so more of the
        // grid lands above the fold without any tile getting narrower.
        className="press glass-card relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-3xl p-3 text-center"
      >
        {/* Corner-mounted rather than stacked under the label: as a third line
            it pushed the icon and label off the tile's centre, so only the
            members-only tiles looked aligned differently from the rest. */}
        {item.membersOnly && (
          <span className="util-label absolute right-2.5 top-2 text-[9px] text-carz">
            {EXPLORE_COPY.membersBadge}
          </span>
        )}
        <Icon className="h-6 w-6 shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="text-[13px] font-semibold leading-tight">{item.label}</span>
      </Link>
      <span className="mt-2 block text-center text-[11px] leading-snug opacity-60">
        {item.description}
      </span>
    </div>
  );
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");

  const bubbles = useMemo(
    () => EXPLORE_BUBBLES.filter((i) => matchesExploreQuery(i, query)),
    [query],
  );
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-12 pt-10">
      {/* The wordmark alone, in place of the header: the app should still say
          whose front door this is, without putting a menu back on it. */}
      <div className="text-center">
        <Link href="/explore" className="press inline-flex items-center">
          <span className="wordmark whitespace-nowrap text-3xl leading-none">Carz AI</span>
        </Link>
        <p className="mt-2 text-[13px] opacity-60">{EXPLORE_COPY.tagline}</p>
      </div>

      <div className="relative mt-6">
        {/* Click-through so a tap on the icon still lands in the field. */}
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={EXPLORE_COPY.searchPlaceholder}
          aria-label={EXPLORE_COPY.searchLabel}
          autoComplete="off"
          className="h-11 pl-9"
        />
      </div>

      {bubbles.length === 0 ? (
        <p className="mt-8 text-center text-[13px] opacity-60">{EXPLORE_COPY.empty}</p>
      ) : (
        // Two across on a phone keeps every tile a comfortable tap; three once
        // there is room, so the whole app still fits one screen.
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
          {bubbles.map((item) => (
            <Bubble key={item.label} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}

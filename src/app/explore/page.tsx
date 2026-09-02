"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageMasthead } from "@/components/ui/editorial";
import { Input } from "@/components/ui/input";
import {
  EXPLORE_BUBBLES,
  EXPLORE_COPY,
  matchesExploreQuery,
  type ExploreItem,
} from "@/config/explore";

/**
 * The front door: the whole app on one screen as a grid of bubbles.
 *
 * This is where the app opens, so it carries no site header. The bubbles are
 * the navigation — a menu bar above them would be a second, smaller copy of
 * the same thing, and the hamburger is the exact gesture this page exists to
 * make unnecessary. Every page a bubble leads to still has the header, with an
 * Explore link in it to come back.
 *
 * One page, no sections — the point is to take it all in at a glance rather
 * than read down a list, so everything is the same size and nothing is filed
 * under a heading you have to scroll past.
 *
 * Nothing here knows anything about the features it lists — it renders a config
 * and links onward. Members-only bubbles link exactly like the rest, because
 * each destination already gates itself.
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
        // home screen uses. It also gives the label its corners back, which a
        // circle spends on empty space.
        // 4:3 rather than square — full width, but shorter, so more of the grid
        // lands above the fold without any tile getting narrower.
        className="press glass-card flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-3xl p-3 text-center"
      >
        <Icon className="h-6 w-6 shrink-0" strokeWidth={1.75} aria-hidden />
        {/* Long pairings like "Auctions & Wishlist" still wrap, but a squircle
            has the width to hold them without being narrowed at the corners. */}
        <span className="text-[13px] font-semibold leading-tight">{item.label}</span>
        {item.membersOnly && (
          <span className="util-label text-carz">{EXPLORE_COPY.membersBadge}</span>
        )}
      </Link>
      {/* Outside the circle: there is no room for it inside, and it would push
          the label off-centre. */}
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
    <>
      {/* The wordmark alone, in place of the header: the app should still say
          whose front door this is, without putting a menu back on it. */}
      <div className="flex justify-center px-5 pt-8">
        <Link href="/explore" className="press flex items-center">
          <span className="wordmark whitespace-nowrap text-2xl leading-none">Carz AI</span>
        </Link>
      </div>

      <main className="mx-auto w-full max-w-3xl px-5 pb-10 pt-6">
        <PageMasthead title={EXPLORE_COPY.title} eyebrow={EXPLORE_COPY.eyebrow} />
        <p className="mt-3 max-w-prose text-[13px] leading-relaxed opacity-60">
          {EXPLORE_COPY.subtitle}
        </p>

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
          <p className="mt-8 text-[13px] opacity-60">{EXPLORE_COPY.empty}</p>
        ) : (
          // Two across on a phone keeps every bubble a comfortable tap; three
          // once there is room, so the whole app still fits one screen.
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
            {bubbles.map((item) => (
              <Bubble key={item.label} item={item} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

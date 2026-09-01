"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PageMasthead } from "@/components/ui/editorial";
import { Input } from "@/components/ui/input";
import {
  EXPLORE_COPY,
  EXPLORE_SECTIONS,
  EXPLORE_START_HERE,
  matchesExploreQuery,
  type ExploreItem,
} from "@/config/explore";

/**
 * The front door: every feature in Carz on one screen.
 *
 * Nothing here knows anything about the features it lists — it renders the
 * config and links onward. Members-only rows link exactly like the rest,
 * because each destination already gates itself and a second copy of that
 * logic here could only ever disagree with the first.
 *
 * All copy lives in src/config/explore.ts.
 */

/** One tappable row: icon · label · description · chevron. */
function ExploreRow({ item }: { item: ExploreItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="press glass-card flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold">{item.label}</span>
          {item.membersOnly && (
            <span className="util-label text-carz">{EXPLORE_COPY.membersBadge}</span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[13px] opacity-60">{item.description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-40" aria-hidden />
    </Link>
  );
}

/** The three things someone most likely opened the app to do. */
function StartHereTile({ item }: { item: ExploreItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="press glass-card flex flex-col justify-between gap-4 rounded-2xl p-5"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06]">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="block">
        <span className="block text-base font-semibold">{item.label}</span>
        <span className="mt-1 block text-[13px] leading-relaxed opacity-60">
          {item.description}
        </span>
      </span>
    </Link>
  );
}

export default function ExplorePage() {
  const [query, setQuery] = useState("");
  const searching = query.trim() !== "";

  // Sections drop out entirely once nothing in them matches, so the filtered
  // view is a short list rather than a page of empty headings.
  const sections = useMemo(
    () =>
      EXPLORE_SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((i) => matchesExploreQuery(i, query)),
      })).filter((s) => s.items.length > 0),
    [query],
  );

  const nothingMatches = searching && sections.length === 0;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
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

        {/* Browsing and searching are different screens: once someone has typed,
            the shortcuts are noise between them and their answer. */}
        {!searching && (
          <section className="mt-8">
            <h2 className="util-label">{EXPLORE_COPY.startHere}</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {EXPLORE_START_HERE.map((item) => (
                <StartHereTile key={item.label} item={item} />
              ))}
            </div>
          </section>
        )}

        {nothingMatches ? (
          <p className="mt-8 text-[13px] opacity-60">{EXPLORE_COPY.empty}</p>
        ) : (
          sections.map((section) => (
            <section key={section.title} className="mt-8">
              <h2 className="util-label">{section.title}</h2>
              <div className="mt-3 space-y-3">
                {section.items.map((item) => (
                  // Two rows can share a destination (membership and redeeming
                  // a code both land on /membership), so the label is the key.
                  <ExploreRow key={item.label} item={item} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>
    </>
  );
}

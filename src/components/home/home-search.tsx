"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SearchPill } from "@/components/ui/editorial";
import { EXPLORE_BUBBLES, matchesExploreQuery } from "@/config/explore";

/**
 * The hero's search field.
 *
 * A client island rather than a client page: everything else on Home is
 * server-rendered so the hero photo is right on the first paint, and this is
 * the only part that needs a router.
 *
 * It matches as you type. Before, nothing happened until Return, so the fastest
 * route to a page was to type its name, press Return, land on /search and tap
 * the result -- two screens to reach something the first keystroke already
 * knew. The matcher is the one /search uses, run over a dozen static entries,
 * so there is nothing to debounce and no request to make. Return still goes to
 * /search, which also searches accounts.
 *
 * Capped at four: five would reach the row of tiles underneath, and the panel
 * floats over the page rather than pushing it down.
 */
export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const matches = q.trim()
    ? EXPLORE_BUBBLES.filter((item) => matchesExploreQuery(item, q)).slice(0, 4)
    : [];

  return (
    <div className="relative">
      <SearchPill
        value={q}
        onChange={setQ}
        onSubmit={() => {
          const term = q.trim();
          if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
        }}
        placeholder="Search any car..."
        label="Search any car"
      />

      {matches.length > 0 && (
        // Opaque, not glass. §2: glass needs something moving behind it, and
        // this floats over a flat page with a row of tiles directly under it
        // -- as a glass panel the tiles read straight through the suggestions
        // and neither was legible. A popover is a standard surface with the
        // §7 popover shadow. Absolutely positioned so the sections below do
        // not jump down and back up on every keystroke.
        <ul className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-card border border-[var(--line-divider)] bg-[var(--color-raised)] shadow-[0_10px_40px_rgb(0_0_0/0.35)]">
          {matches.map(({ href, label, description, icon: Icon }, i) => (
            <li
              key={href}
              className={
                i === 0 ? "" : "border-t border-[var(--line-divider)]"
              }
            >
              <Link
                href={href}
                // Clearing the box is what dismisses the panel, so one piece
                // of state covers both and they cannot disagree.
                onClick={() => setQ("")}
                className="press flex min-h-11 items-center gap-3 px-4 py-2.5"
              >
                <Icon
                  className="h-[18px] w-[18px] shrink-0 text-[var(--color-muted-text)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-foreground">
                    {label}
                  </span>
                  <span className="block truncate text-[13px] text-[var(--color-secondary-text)]">
                    {description}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--color-muted-text)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

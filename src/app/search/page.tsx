"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search as SearchIcon, Crown, X, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/default-avatar";
import { EXPLORE_BUBBLES, matchesExploreQuery } from "@/config/explore";
import { cn } from "@/lib/utils";

type Account = {
  username: string;
  displayName: string;
  image: string;
  bio: string;
  member: boolean;
};

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchInner />
    </Suspense>
  );
}

function SearchInner() {
  const router = useRouter();
  const initial = useSearchParams().get("q") ?? "";
  const [q, setQ] = useState(initial);

  // Only once something is typed: an empty query matches every feature, and a
  // wall of them under an empty box is not a search result.
  const features = q.trim()
    ? EXPLORE_BUBBLES.filter((item) => matchesExploreQuery(item, q))
    : [];
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = useCallback((term: string) => {
    const query = term.trim();
    if (!query) {
      setAccounts([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setAccounts(d.accounts ?? []);
        setSearched(true);
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  // Debounced: a request per keystroke reads the whole profile store each time.
  useEffect(() => {
    const t = setTimeout(() => run(q), 250);
    return () => clearTimeout(t);
  }, [q, run]);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-6">
      {/* The app's own capsule, not the stock shadcn <Input>.
      
          That component draws `rounded-lg border border-input` on top of
          `shadow-sm`, and in this app neither token resolves at the element:
          measured in WebKit it came out as border-radius 0 with a 1px opaque
          white border, so searching from Home landed you on a hard-cornered
          white box around a field that is a capsule everywhere else in the
          app. That box is the "random square on top of the textbox".
      
          The classes below are the ones SearchPill uses, so this field and
          the one on Home are the same object seen twice. Not SearchPill
          itself only because this one carries a clear button inside the
          field, which that component has no slot for. */}
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--color-muted-text)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search cars, features or people…"
          aria-label="Search cars, features or people"
          className={cn(
            "h-[52px] w-full rounded-full glass-card",
            "pl-11 pr-14 text-[15px] text-foreground outline-none",
            "placeholder:text-[var(--color-muted-text)]",
            // Safari draws its own X inside type=search and it is not ours.
            "[&::-webkit-search-cancel-button]:appearance-none",
          )}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear"
            // 44px, not the 32 it was: it sits inside a field people are
            // typing into, which is the worst place to miss a target.
            className="press absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full"
          >
            <X className="h-[18px] w-[18px] text-[var(--color-secondary-text)]" aria-hidden />
          </button>
        )}
      </div>

      {q.startsWith("#") && (
        <p className="mt-3 text-[15px] opacity-60">
          Hashtag search isn&apos;t indexed yet — this searches features and accounts.
        </p>
      )}

      {/* Features first, matched locally.

          Search only looked at accounts, so typing "garage" or "bid" found
          nothing even though both are things this app does. The list is the same
          config Home renders from and the match is the same function, so there is
          one answer to "what does this app have" rather than two that drift. No
          request, so it appears as you type. */}
      {features.length > 0 && (
        <section className="mt-5">
          <h2 className="util-label opacity-50">Features</h2>
          <div className="mt-1">
            {features.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="press flex min-h-14 items-center gap-3 border-b border-[var(--line-divider)] px-1 py-3"
                >
                  <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{item.label}</span>
                    <span className="block truncate text-[14px] text-[var(--color-secondary-text)]">
                      {item.description}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-[18px] w-[18px] shrink-0 text-[var(--color-muted-text)]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-5 space-y-1">
        {loading && accounts.length === 0 &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2.5">
              <div className="h-11 w-11 animate-pulse glass-chip rounded-full" />
              <div className="flex-1">
                <div className="h-3.5 w-32 animate-pulse rounded bg-foreground/[0.06]" />
                <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-foreground/[0.04]" />
              </div>
            </div>
          ))}

        {accounts.map((a) => (
          <button
            key={a.username}
            type="button"
            onClick={() => router.push(`/channel/${encodeURIComponent(a.username)}`)}
            className="press flex w-full items-center gap-3 rounded-card px-2 py-2.5 text-left transition-colors hover:glass-chip"
          >
            <Avatar src={a.image} size={44} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-semibold">{a.displayName}</span>
                {a.member && (
                  <Crown className="h-3.5 w-3.5 shrink-0 text-rank-1" fill="currentColor" strokeWidth={2} aria-hidden />
                )}
              </span>
              <span className="block truncate text-[15px] opacity-50">@{a.username}</span>
              {a.bio && <span className="mt-0.5 block truncate text-[12px] opacity-40">{a.bio}</span>}
            </span>
          </button>
        ))}

        {searched && !loading && accounts.length === 0 && (
          <p className="py-10 text-center text-[15px] opacity-60">
            Nobody matches “{q.trim()}”.
          </p>
        )}

        {!searched && !loading && (
          <p className="py-10 text-center text-[15px] opacity-50">
            Search for someone by name or @handle.
          </p>
        )}
      </div>

    </main>
  );
}

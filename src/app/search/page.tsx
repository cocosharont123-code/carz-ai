"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon, Crown, X } from "lucide-react";
import { Avatar } from "@/components/default-avatar";
import { Input } from "@/components/ui/input";

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
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-40"
          aria-hidden
        />
        <Input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search accounts…"
          aria-label="Search accounts"
          className="h-12 pl-9 pr-10"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear"
            className="press absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full hover:bg-white/[0.08]"
          >
            <X className="h-4 w-4 opacity-60" aria-hidden />
          </button>
        )}
      </div>

      {q.startsWith("#") && (
        <p className="mt-3 text-[13px] opacity-60">
          Hashtag search isn&apos;t indexed yet — this searches accounts.
        </p>
      )}

      <div className="mt-5 space-y-1">
        {loading && accounts.length === 0 &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-2.5">
              <div className="h-11 w-11 animate-pulse rounded-full bg-white/[0.06]" />
              <div className="flex-1">
                <div className="h-3.5 w-32 animate-pulse rounded bg-white/[0.06]" />
                <div className="mt-1.5 h-3 w-20 animate-pulse rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}

        {accounts.map((a) => (
          <button
            key={a.username}
            type="button"
            onClick={() => router.push(`/channel/${encodeURIComponent(a.username)}`)}
            className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
          >
            <Avatar src={a.image} size={44} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{a.displayName}</span>
                {a.member && (
                  <Crown className="h-3.5 w-3.5 shrink-0 text-rank-1" fill="currentColor" strokeWidth={2} aria-hidden />
                )}
              </span>
              <span className="block truncate text-[13px] opacity-50">@{a.username}</span>
              {a.bio && <span className="mt-0.5 block truncate text-[11px] opacity-40">{a.bio}</span>}
            </span>
          </button>
        ))}

        {searched && !loading && accounts.length === 0 && (
          <p className="py-10 text-center text-[13px] opacity-60">
            Nobody matches “{q.trim()}”.
          </p>
        )}

        {!searched && !loading && (
          <p className="py-10 text-center text-[13px] opacity-50">
            Search for someone by name or @handle.
          </p>
        )}
      </div>

      <p className="mt-8 text-center">
        <Link href="/feed" className="util-label opacity-50 hover:opacity-100">
          Back to the feed
        </Link>
      </p>
    </main>
  );
}

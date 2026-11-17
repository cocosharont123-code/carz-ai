"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Rocket } from "lucide-react";
import { PageMasthead, Skeleton, Button } from "@/components/ui/editorial";
import { cn } from "@/lib/utils";

type Drop = {
  make: string;
  model: string;
  category: "Hypercar" | "Supercar" | "Luxury";
  startingPriceUsd: number;
  status: string;
  timing: string;
  powertrain: string;
  headline: string;
  note: string;
};

const MIN_PRICE_USD = 120_000;
const FILTERS = ["All", "Hypercar", "Supercar", "Luxury"] as const;

function money(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2).replace(/0$/, "")}M`;
  }
  return `$${Math.round(n / 1000)}k`;
}

/**
 * One drop.
 *
 * Rewritten because the old card leaked out of itself. Three things did it,
 * and they are worth naming so they are not rebuilt:
 *
 *  - A 34px price in a `shrink-0` column. The model name truncated politely,
 *    the price could not, and on a narrow screen it pushed through the side
 *    of the card. It is 22px, tabular, and allowed to wrap off its own line
 *    rather than shove the name.
 *  - Two nested boxes holding model text -- "Twin-turbo V8 hybrid with
 *    electric front axle" against a 50% column -- with nothing to break a
 *    long word on. The figures are one line now, not two boxes, and the text
 *    may break anywhere it has to (break-words).
 *  - glass-card on every item of a list. That is a live backdrop-filter per
 *    card and up to sixteen cards: §2 allows six on a whole screen, and the
 *    lag was them. glass-lite is the same material without the blur, which
 *    is what §2 says a repeated item gets.
 */
function DropCard({ drop }: { drop: Drop }) {
  return (
    <article className="rounded-card glass-lite p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="util-label min-w-0 truncate opacity-60">{drop.make}</p>
        <p className="shrink-0 text-[17px] font-bold tabular-nums">
          {money(drop.startingPriceUsd)}
        </p>
      </div>

      {/* Two lines at most, then an ellipsis. A model name is three words;
          anything longer is the model returning a sentence, and a sentence
          here would push the card open. */}
      <h2 className="mt-1 line-clamp-2 text-[20px] font-extrabold leading-tight tracking-tight">
        {drop.model}
      </h2>

      {/* The one number that defines it, and what makes it. One line of
          text rather than a pair of boxes: break-words so a hyphenated
          powertrain cannot reach past the edge. */}
      <p className="mt-1.5 break-words text-[14px] leading-snug text-[var(--color-secondary-text)]">
        {[drop.headline, drop.powertrain].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-foreground/10 px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide text-foreground">
          {drop.category}
        </span>
        <span className="glass-lite rounded-full px-2.5 py-1 text-[12px] font-semibold">
          {drop.status}
        </span>
        <span className="glass-lite rounded-full px-2.5 py-1 text-[12px] font-semibold">
          {drop.timing}
        </span>
      </div>

      {drop.note && (
        <p className="mt-3 break-words text-[14px] leading-relaxed opacity-70">{drop.note}</p>
      )}
    </article>
  );
}

export default function DropsPage() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);

  // Pure fetch — nothing is written to state inside the effect body below.
  const load = useCallback(async () => {
    const res = await fetch("/api/drops", { cache: "no-store" });
    const d = await res.json();
    if (d.configured === false) return { configured: false, drops: [] as Drop[] };
    if (!res.ok) throw new Error(d.error || "Couldn't load new drops.");
    return { configured: true, drops: (Array.isArray(d.drops) ? d.drops : []) as Drop[] };
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((r) => {
        if (cancelled) return;
        setConfigured(r.configured);
        setDrops(r.drops);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const shown = filter === "All" ? drops : drops.filter((d) => d.category === filter);

  return (
    <>
      <main className="mx-auto w-full max-w-4xl px-5 py-10">
        <PageMasthead
          eyebrow={`New metal · from $${(MIN_PRICE_USD / 1000).toFixed(0)}k up`}
          title="New Drops"
          count={loading ? "—" : `${shown.length} listed`}
        />

        <p className="mt-3 max-w-prose text-[15px] leading-relaxed opacity-60">
          Hypercars, supercars and luxury cars that have just been revealed, opened for order, or
          started deliveries. Nothing under ${MIN_PRICE_USD.toLocaleString("en-US")}.
        </p>

        {!loading && drops.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const count = f === "All" ? drops.length : drops.filter((d) => d.category === f).length;
              if (f !== "All" && count === 0) return null;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={cn(
                    "press rounded-full px-4 py-1.5 text-[15px] font-semibold transition",
                    filter === f
                      ? "bg-carz text-carz-ink"
                      : "border border-[var(--line-card)] hover:border-foreground/40",
                  )}
                >
                  {f}
                  <span className="ml-1.5 opacity-50">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Four at the card's real height, so nothing jumps when the
                list arrives. The cards are shorter than they were. */}
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-card" />
            ))}
          </div>
        ) : !configured ? (
          <div className="mt-8 rounded-card glass-card p-10 text-center">
            <Rocket className="mx-auto h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-[17px] font-bold">Drops aren&apos;t switched on yet</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[15px] opacity-60">
              This section needs <code>ANTHROPIC_API_KEY</code> set on the server.
            </p>
          </div>
        ) : error || shown.length === 0 ? (
          <div className="mt-8 rounded-card glass-card p-10 text-center">
            <Rocket className="mx-auto h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-[17px] font-bold">
              {error ? "Couldn't load new drops" : "Nothing in this class right now"}
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[15px] opacity-60">
              {error || "Try another category."}
            </p>
            {error && (
              <Button href="/drops" className="mt-5">
                Try again
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {shown.map((d) => (
              <DropCard key={`${d.make}-${d.model}`} drop={d} />
            ))}
          </div>
        )}

        {/* The list is compiled by a model from what it knows, not pulled from a
            manufacturer feed. Saying so plainly beats implying a price is
            authoritative when someone might act on it. */}
        {!loading && shown.length > 0 && (
          <p className="mt-8 flex items-start justify-center gap-1.5 text-center text-[12px] leading-relaxed opacity-45">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              Compiled by AI, not a manufacturer feed — prices and timing are indicative. Check with
              the maker before ordering one.
            </span>
          </p>
        )}
      </main>
    </>
  );
}

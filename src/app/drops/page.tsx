"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles, Rocket } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
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

function DropCard({ drop }: { drop: Drop }) {
  return (
    <article className="rounded-3xl border border-black/10 bg-card text-card-foreground p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="util-label opacity-60">{drop.make}</p>
          <h2 className="mt-0.5 truncate text-lg font-extrabold tracking-tight">{drop.model}</h2>
        </div>
        <div className="shrink-0 text-right">
          <div className="display text-3xl leading-none">{money(drop.startingPriceUsd)}</div>
          <p className="util-label mt-1 opacity-50">from</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
            drop.category === "Hypercar"
              ? "bg-neon-red/15 text-neon-red"
              : drop.category === "Supercar"
                ? "bg-carz/15 text-carz-ink"
                : "bg-black/[0.07]",
          )}
        >
          {drop.category}
        </span>
        <span className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-semibold">
          {drop.status}
        </span>
        <span className="rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-semibold">
          {drop.timing}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-black/[0.05] p-3">
          <div className="text-[11px] uppercase tracking-wide opacity-60">Powertrain</div>
          <div className="mt-0.5 text-[13px] font-semibold">{drop.powertrain}</div>
        </div>
        <div className="rounded-xl bg-black/[0.05] p-3">
          <div className="text-[11px] uppercase tracking-wide opacity-60">Headline</div>
          <div className="mt-0.5 text-[13px] font-semibold">{drop.headline}</div>
        </div>
      </div>

      {drop.note && <p className="mt-3 text-[13px] leading-relaxed opacity-70">{drop.note}</p>}
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
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-5 py-10">
        <PageMasthead
          eyebrow={`New metal · from $${(MIN_PRICE_USD / 1000).toFixed(0)}k up`}
          title="New Drops"
          count={loading ? "—" : `${shown.length} listed`}
        />

        <p className="mt-3 max-w-prose text-[13px] leading-relaxed opacity-60">
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
                    "press rounded-full px-4 py-1.5 text-[13px] font-semibold transition",
                    filter === f
                      ? "bg-white text-black"
                      : "border border-white/15 hover:border-white/40",
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
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-56 w-full rounded-3xl" />
            ))}
          </div>
        ) : !configured ? (
          <div className="mt-8 rounded-3xl border border-black/10 bg-card text-card-foreground p-10 text-center">
            <Rocket className="mx-auto h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-lg font-bold">Drops aren&apos;t switched on yet</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">
              This section needs <code>ANTHROPIC_API_KEY</code> set on the server.
            </p>
          </div>
        ) : error || shown.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-black/10 bg-card text-card-foreground p-10 text-center">
            <Rocket className="mx-auto h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-3 text-lg font-bold">
              {error ? "Couldn't load new drops" : "Nothing in this class right now"}
            </h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">
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
          <p className="mt-8 flex items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed opacity-45">
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

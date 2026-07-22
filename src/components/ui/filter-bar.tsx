"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/* Booking-bar style filter: connected bordered row — segmented tabs, an input,
   and a yellow submit. Presentational; hand it an onSubmit(tab, query). */
export function FilterBar({
  tabs,
  placeholder = "Search…",
  submitLabel = "Search",
  onSubmit,
  className,
}: {
  tabs: string[];
  placeholder?: string;
  submitLabel?: string;
  onSubmit?: (tab: string, query: string) => void;
  className?: string;
}) {
  const [tab, setTab] = useState(tabs[0]);
  const [q, setQ] = useState("");

  return (
    <div className={cn("flex flex-col border border-white/15 sm:flex-row sm:items-stretch", className)}>
      {/* segmented tabs */}
      <div className="flex border-b border-white/15 sm:border-b-0 sm:border-r">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "util-label flex-1 whitespace-nowrap px-4 py-3 transition-colors sm:flex-none",
              t === tab ? "bg-carz text-carz-ink" : "text-white/60 hover:text-white",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {/* input */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit?.(tab, q.trim())}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
      />
      {/* submit */}
      <button
        onClick={() => onSubmit?.(tab, q.trim())}
        className="util-label bg-carz px-6 py-3 text-carz-ink transition hover:brightness-95"
      >
        {submitLabel}
      </button>
    </div>
  );
}

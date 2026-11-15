"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import type { CarEvent } from "@/lib/events-blob";

/**
 * Upcoming Events on Home, with actual events in it.
 *
 * It was one static card -- "Find car meets near you" -- and the reason was
 * sound at the time: the list comes from a model call that needs a location,
 * so there was nothing to read without paying for a generation on every home
 * page load. The route caches per place in Blob now, so this is a JSON read
 * of a list somebody has already generated, and the card can be the events
 * themselves.
 *
 * GET, deliberately, not the POST the events page makes: GET only reads the
 * cache. Home never prompts for a location and never starts a generation --
 * it shows what is known for the place this browser last looked at, and falls
 * back to the old card when that is nothing.
 *
 * Two rows. Measured, not guessed: at three, Home gained 77px of scroll on a
 * 390x844 screen, and a screen that fits is not allowed to scroll (§4). "See
 * all" is right there for the rest.
 */
export function HomeEvents() {
  const [events, setEvents] = useState<CarEvent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => {
        if (!cancelled) setEvents(Array.isArray(d?.events) ? d.events.slice(0, 2) : []);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A fixed-height placeholder while the read is in flight, at the height of
  // the card it is about to be replaced by, so nothing below it moves (§1).
  if (events === null) return <div aria-hidden className="h-24" />;

  if (events.length === 0) {
    return (
      <Link
        href="/events"
        className="press glass-card relative flex min-h-24 items-end overflow-hidden rounded-tile p-4"
      >
        <span className="relative flex w-full items-center gap-3">
          <Calendar className="h-5 w-5 shrink-0 text-foreground" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-bold text-foreground">
              Find car meets near you
            </span>
            <span className="block truncate text-[12px] text-[var(--color-secondary-text)]">
              Meets, concours and track days
            </span>
          </span>
          <ChevronRight
            className="h-[18px] w-[18px] shrink-0 text-[var(--color-muted-text)]"
            strokeWidth={1.75}
            aria-hidden
          />
        </span>
      </Link>
    );
  }

  return (
    <div className="space-y-2.5">
      {events.map((e) => (
        <Link
          key={`${e.name}-${e.city}`}
          href="/events"
          className="press glass-card flex min-h-[72px] items-center gap-3 rounded-tile p-3.5"
        >
          <Calendar className="h-5 w-5 shrink-0 text-foreground" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-foreground">{e.name}</span>
            {/* Type, city and timing on one line: three short facts, and the
                row is a quarter of a phone screen wide. */}
            <span className="block truncate text-[12px] text-[var(--color-secondary-text)]">
              {[e.type, e.city, e.when].filter(Boolean).join(" · ")}
            </span>
          </span>
          <ChevronRight
            className="h-[18px] w-[18px] shrink-0 text-[var(--color-muted-text)]"
            strokeWidth={1.75}
            aria-hidden
          />
        </Link>
      ))}
    </div>
  );
}

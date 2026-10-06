"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, MapPin } from "lucide-react";
import { MemberGate } from "@/components/member-gate";
import { PageMasthead, Button, Skeleton } from "@/components/ui/editorial";

type Ev = { name: string; type: string; venue?: string; city: string; when: string; note?: string };

const TYPE_STYLE: Record<string, string> = {
  "Cars & Coffee": "bg-foreground/10 text-foreground",
  Concours: "bg-foreground/10 text-foreground",
  Auction: "bg-foreground/10 text-foreground",
  "Track day": "bg-foreground/10 text-foreground",
  "Car show": "bg-foreground/10 text-foreground",
  Rally: "bg-foreground/10 text-foreground",
  Meet: "bg-foreground/10 text-foreground",
};

const searchUrl = (e: Ev) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${e.name} ${e.venue || ""} ${e.city} car event`)}`;

export default function EventsPage() {
  return (
    <MemberGate
      title="Events"
      blurb="Luxury and sports car events happening near you."
      points={[
        "Finds Cars & Coffee, concours, auctions, track days and meets around your location.",
        "Automatically uses your city, or search any other city.",
        "Each listing links straight to the details so you can plan to go.",
      ]}
    >
      <EventsInner />
    </MemberGate>
  );
}

function EventsInner() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [place, setPlace] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needCity, setNeedCity] = useState(false);

  const load = useCallback(async (payload: { lat?: number; lng?: number; place?: string }) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok || !Array.isArray(d.events)) {
        setError(d.error || "Couldn't load events.");
        setEvents([]);
        return;
      }
      setPlace(d.place || "");
      setEvents(d.events);
    } catch {
      setError("Network error — try again.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setNeedCity(true);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => load({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setLoading(false);
        setNeedCity(true);
      },
      { timeout: 8000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <main className="mx-auto w-full max-w-[480px] px-5 pb-6 pt-4">
        <PageMasthead
          eyebrow="Luxury & sports cars near you"
          title="Events & Meets"
          count={place ? place : loading ? "Locating…" : undefined}
        />

        {/* City search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) load({ place: query.trim() });
          }}
          className="mt-5 flex gap-2"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={needCity ? "Enter your city…" : "Different city? Type it here…"}
            aria-label="City"
            className="h-[52px] w-full rounded-full glass-card px-4 text-[15px] text-foreground outline-none placeholder:text-[var(--color-muted-text)]"
          />
          <Button type="submit" size="md">
            Find
          </Button>
        </form>

        {loading ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-8 rounded-card glass-card p-8 text-center">
            <h3 className="display text-[20px]">Couldn&apos;t load events</h3>
            <p className="mt-2 text-[15px] opacity-70">{error}</p>
          </div>
        ) : events && events.length > 0 ? (
          <div className="mt-6 space-y-3">
            {events.map((e, i) => (
              <a
                key={i}
                href={searchUrl(e)}
                target="_blank"
                rel="noopener noreferrer"
                className="press block rounded-card glass-card p-4 transition hover:border-[var(--line-button)]"
              >
                {/* No banner photo and no bookmark. The events feed carries a
                    name, a type, a venue, a city and a when -- there is no
                    image on an event and no way to save one, so neither is
                    drawn rather than filled with a placeholder. */}
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[17px] font-semibold leading-tight text-foreground">{e.name}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 util-label ${TYPE_STYLE[e.type] || "bg-foreground/10 text-foreground"}`}>
                    {e.type}
                  </span>
                </div>
                {e.note && (
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-secondary-text)]">{e.note}</p>
                )}
                <p className="mt-3 flex items-center gap-2 text-[14px] text-[var(--color-secondary-text)]">
                  <Calendar className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  {e.when}
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-[14px] text-[var(--color-secondary-text)]">
                  <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                  {[e.venue, e.city].filter(Boolean).join(" · ")}
                </p>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-card glass-card p-8 text-center">
            <h3 className="display text-[20px]">No events found</h3>
            <p className="mt-2 text-[15px] opacity-70">Try a bigger nearby city.</p>
          </div>
        )}

        <p className="mt-6 util-label text-center opacity-50">
          Recurring events & venues — check official listings for exact dates.
        </p>
      </main>
    </>
  );
}

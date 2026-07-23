"use client";

import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { PageMasthead, Button, Skeleton } from "@/components/ui/editorial";

type Ev = { name: string; type: string; venue?: string; city: string; when: string; note?: string };

const TYPE_STYLE: Record<string, string> = {
  "Cars & Coffee": "bg-amber-400/20 text-amber-300",
  Concours: "bg-fuchsia-400/20 text-fuchsia-300",
  Auction: "bg-emerald-400/20 text-emerald-300",
  "Track day": "bg-rose-400/20 text-rose-300",
  "Car show": "bg-sky-400/20 text-sky-300",
  Rally: "bg-violet-400/20 text-violet-300",
  Meet: "bg-cyan-400/20 text-cyan-300",
};

const searchUrl = (e: Ev) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${e.name} ${e.venue || ""} ${e.city} car event`)}`;

export default function EventsPage() {
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
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <PageMasthead
          eyebrow="Luxury & sports cars near you"
          title="Events"
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
            className="w-full rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/30"
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
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-8 text-center">
            <h3 className="display text-2xl">Couldn&apos;t load events</h3>
            <p className="mt-2 text-[13px] opacity-70">{error}</p>
          </div>
        ) : events && events.length > 0 ? (
          <div className="mt-6 space-y-3">
            {events.map((e, i) => (
              <a
                key={i}
                href={searchUrl(e)}
                target="_blank"
                rel="noopener noreferrer"
                className="press lift block rounded-2xl border border-white/10 bg-card text-card-foreground p-4 transition hover:border-white/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{e.name}</p>
                    <p className="mt-0.5 text-[13px] opacity-70">
                      {[e.venue, e.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 util-label ${TYPE_STYLE[e.type] || "bg-white/10 text-white/70"}`}>
                    {e.type}
                  </span>
                </div>
                {e.note && <p className="mt-2 text-[13px] opacity-80">{e.note}</p>}
                <p className="mt-2 util-label opacity-60">🗓️ {e.when} · find details →</p>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-8 text-center">
            <h3 className="display text-2xl">No events found</h3>
            <p className="mt-2 text-[13px] opacity-70">Try a bigger nearby city.</p>
          </div>
        )}

        <p className="mt-6 util-label text-center opacity-50">
          Recurring events & venues — check official listings for exact dates.
        </p>
      </main>
    </>
  );
}

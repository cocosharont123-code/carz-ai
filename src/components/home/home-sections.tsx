"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  ChevronRight,
  Image as ImageIcon,
  Search,
  Ticket,
  Trophy,
} from "lucide-react";
import { FEATURED_CARS, featuredHref } from "@/config/home";

/* --- Search ---------------------------------------------------------------- */

export function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = q.trim();
        if (v) router.push(`/search?q=${encodeURIComponent(v)}`);
      }}
      className="flex h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.06] pl-3.5 pr-1 backdrop-blur-md"
    >
      <Search className="h-4 w-4 shrink-0 text-white/60" strokeWidth={2} aria-hidden />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search any car..."
        aria-label="Search any car"
        enterKeyHint="search"
        className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
      />
      <button
        type="submit"
        aria-label="Search"
        className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"
      >
        <ArrowRight className="h-4 w-4 text-black" strokeWidth={2.5} aria-hidden />
      </button>
    </form>
  );
}

/* --- Quick actions --------------------------------------------------------- */

const ACTIONS = [
  { href: "/carzbot", Icon: Bot, title: "CarzBot", sub: "Ask anything" },
  { href: "/garage", Icon: ImageIcon, title: "Garage", sub: "Your collection" },
  { href: "/leaderboard", Icon: Trophy, title: "Leaderboard", sub: "Rarest cars" },
  { href: "/events", Icon: Ticket, title: "Events & Drops", sub: "Car meets & launches" },
] as const;

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {ACTIONS.map(({ href, Icon, title, sub }) => (
        <Link
          key={href}
          href={href}
          className="press flex h-20 flex-col justify-between rounded-[16px] border border-white/12 bg-white/[0.06] p-2.5 backdrop-blur-md"
        >
          <Icon className="h-[26px] w-[26px] text-white" strokeWidth={1.75} aria-hidden />
          <span>
            <span className="block truncate text-[14px] font-bold leading-tight text-white">{title}</span>
            <span className="block truncate text-[11px] leading-tight text-[#8E8E93]">{sub}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/* --- Section header -------------------------------------------------------- */

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[21px] font-bold text-white">{title}</h2>
      <Link href={href} className="press text-[15px] text-[#8E8E93]">
        See all ›
      </Link>
    </div>
  );
}

/* --- Featured cars --------------------------------------------------------- */

export function FeaturedCars() {
  return (
    <section>
      <SectionHead title="Featured Cars" href="/search" />
      {/* Exactly three across: the row is the column minus its 20px margins and
          the two 10px gaps, split three ways. Snap so a flick lands on a card
          rather than between two. */}
      <div className="mt-3 -mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]{display:none}">
        {FEATURED_CARS.map((car) => (
          <Link
            key={car.id}
            href={featuredHref(car)}
            className="press shrink-0 snap-start overflow-hidden rounded-[14px] border border-white/12 bg-white/[0.06]"
            style={{ width: "calc((100% - 20px) / 3)", height: "105px" }}
          >
            <div className="relative h-[65%] w-full bg-white/[0.04]">
              {car.image && <Image src={car.image} alt="" fill className="object-cover" />}
            </div>
            <div className="flex h-[35%] items-center justify-between gap-1 px-2">
              <span className="min-w-0">
                <span className="block truncate text-[13px] leading-tight text-white">{car.make}</span>
                <span className="block truncate text-[13px] font-bold leading-tight text-white">
                  {car.model}
                </span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* --- Upcoming events ------------------------------------------------------- */

type Ev = { name: string; city: string; when: string };

export function UpcomingEvents() {
  const [ev, setEv] = useState<Ev | null | "none">(null);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      void fetch("/api/events", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (!alive) return;
          const first = Array.isArray(d.events) ? d.events[0] : null;
          setEv(first ?? "none");
        })
        .catch(() => alive && setEv("none"));
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, []);

  // The events endpoint returns no photo, so the card is a gradient panel
  // rather than a photo with a gradient over it.
  const title = ev && ev !== "none" ? ev.name : "Miami Car Meet";
  const meta = ev && ev !== "none" ? `${ev.when} · ${ev.city}` : "Sat, Nov 16 · Miami, FL";

  return (
    <section>
      <SectionHead title="Upcoming Events" href="/events" />
      <Link
        href="/events"
        className="press relative mt-3 flex h-[95px] items-end overflow-hidden rounded-[16px] border border-white/12 bg-gradient-to-br from-white/[0.10] to-white/[0.03] p-3.5 backdrop-blur-md"
      >
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="relative flex w-full items-end justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-[17px] font-bold text-white">{title}</span>
            <span className="block truncate text-[12px] text-[#8E8E93]">{meta}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
        </span>
      </Link>
    </section>
  );
}

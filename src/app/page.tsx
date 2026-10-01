"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Calendar, Crosshair, Crown } from "lucide-react";
import { EXPLORE_BUBBLES } from "@/config/explore";
import { SearchPill, ListRow } from "@/components/ui/editorial";
import { HomeGarage } from "@/components/home/home-garage";
import Link from "next/link";

/**
 * Home.
 *
 * Also the app's index. The tab bar carries five destinations and no menu, so
 * the list that used to live behind the hamburger lives here -- four tiles for
 * the things worth a tile, then every remaining feature as a row. Nothing the
 * app can do is reachable only by typing a URL.
 */

/** On the tab bar already, so not repeated as a row. */
const ON_THE_TABS = new Set(["/spot", "/map", "/hunt"]);

/** The four that get a tile. Their rows are dropped. */
const TILES = [
  { href: "/carzbot", Icon: Bot, title: "CarzBot", caption: "Ask anything\nabout cars" },
  { href: "/events", Icon: Calendar, title: "Events", caption: "Car meets\n& drops" },
  { href: "/hunt", Icon: Crosshair, title: "Hunt", caption: "Find\n& win" },
  { href: "/pricing", Icon: Crown, title: "Carz+", caption: "Premium\ntools" },
] as const;

const TILED: ReadonlySet<string> = new Set<string>(TILES.map((t) => t.href));

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const rows = EXPLORE_BUBBLES.filter(
    (item) => !ON_THE_TABS.has(item.href) && !TILED.has(item.href),
  );

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-6">
      {/* Wordmark only. The mockup puts a bell beside it for car alerts and
          there is no alerts feature to open, so there is no bell. */}
      <header className="flex h-14 items-center">
        <span className="text-[20px] font-bold lowercase tracking-tight text-white">carz</span>
      </header>

      <Hero />

      <SearchPill
        className="mt-6"
        value={q}
        onChange={setQ}
        onSubmit={() => {
          const term = q.trim();
          if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
        }}
        placeholder="Search any car..."
        label="Search any car"
      />

      {/* Four across, one row, on every width. The captions are pre-broken to
          two lines so all four tiles are the same height whatever the device
          does to the wrapping. */}
      <nav aria-label="Features" className="mt-6 grid grid-cols-4 gap-3">
        {TILES.map(({ href, Icon, title, caption }) => (
          <Link
            key={href}
            href={href}
            className="press flex flex-col items-center gap-2 rounded-tile border border-[var(--line-card)] bg-[var(--color-surface)] px-1.5 py-4 text-center"
          >
            <Icon className="h-6 w-6 shrink-0 text-white" strokeWidth={1.75} aria-hidden />
            <span className="text-[13px] font-semibold leading-tight text-white">{title}</span>
            <span className="whitespace-pre-line text-[12px] leading-snug text-[var(--color-secondary-text)]">
              {caption}
            </span>
          </Link>
        ))}
      </nav>

      <section className="mt-6">
        {rows.map((item) => {
          const Icon = item.icon;
          return (
            <ListRow
              key={item.href}
              href={item.href}
              icon={<Icon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />}
              label={item.label}
              meta={item.description}
            />
          );
        })}
      </section>

      <HomeGarage />
    </main>
  );
}

/**
 * The headline over a photo that fades into black.
 *
 * The image is a plain background-image rather than next/image: if /hero.jpg is
 * not there the element is simply black, where a missing <img> is a broken-image
 * glyph. The spec asks for black, never a broken image, and this is the version
 * that cannot break.
 *
 * The fade is the one gradient the spec allows, and it has to reach full black
 * at the bottom or the type sits on a grey seam.
 */
function Hero() {
  return (
    <section className="relative -mx-5 mt-2 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-black bg-cover bg-center"
        style={{ backgroundImage: "url('/hero.jpg')" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/70 to-black"
      />
      <h1 className="relative px-5 pb-10 pt-16 text-left text-[50px] font-black leading-[0.95] tracking-[-0.02em]">
        <span className="block text-white">SNAP</span>
        <span className="block text-white">ANY CAR.</span>
        <span className="block text-[var(--color-hero-2)]">KNOW</span>
        <span className="block text-[var(--color-hero-2)]">EVERYTHING.</span>
      </h1>
    </section>
  );
}

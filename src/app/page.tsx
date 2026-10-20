import Link from "next/link";
import { Bot, Image as ImageIcon, Trophy, Ticket, ChevronRight, Calendar } from "lucide-react";
import { auth } from "@/auth";
import { getProfile } from "@/lib/profile-blob";
import { HomeHero } from "@/components/home/home-hero";
import { HomeSearch } from "@/components/home/home-search";
import { FEATURED_CARS, featuredHref } from "@/config/featured-cars";

/**
 * Home.
 *
 * A server component, which is what makes the hero photo correct on the first
 * paint: the saved background is read here and handed down, so a viewer who
 * has set one never sees the default appear and swap. The only client islands
 * are the search field and the hero's picker.
 *
 * The tab bar is not rendered here. It is the shared one in the layout, and it
 * already carries Home, Map, Scan, Hunt and Profile with the raised 64px Scan
 * circle -- the same bar this screen was specified with.
 */

/** Four equal cards. Each goes somewhere that exists. */
const QUICK = [
  { href: "/carzbot", Icon: Bot, title: "CarzBot", sub: "Ask anything" },
  { href: "/garage", Icon: ImageIcon, title: "Garage", sub: "Your collection" },
  { href: "/leaderboard", Icon: Trophy, title: "Leaderboard", sub: "Rarest cars" },
  { href: "/events", Icon: Ticket, title: "Events & Drops", sub: "Car meets & launches" },
] as const;

export default async function Home() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  // A failed profile read is a default hero, not a broken page.
  const profile = email ? await getProfile(email).catch(() => null) : null;

  return (
    <main className="w-full px-5 pb-6">
      <HomeHero initialPhoto={profile?.homeHeroPhoto ?? ""} signedIn={!!email} />

      {/* Pulled up onto the hero's fade. The fade ends at solid #000 and the
          page is #000, so the seam is invisible and the pill reads as sitting
          on the photo rather than under a box. */}
      <div className="-mt-3">
        <HomeSearch />
      </div>

      <nav aria-label="Quick actions" className="mt-5 grid grid-cols-4 gap-3">
        {QUICK.map(({ href, Icon, title, sub }) => (
          <Link
            key={href}
            href={href}
            className="press glass-card flex min-h-20 flex-col gap-1 rounded-tile p-2.5"
          >
            <Icon className="h-[26px] w-[26px] shrink-0 text-foreground" strokeWidth={1.75} aria-hidden />
            <span className="mt-auto text-[14px] font-bold leading-tight text-foreground">{title}</span>
            <span className="text-[11px] leading-tight text-[var(--color-secondary-text)]">{sub}</span>
          </Link>
        ))}
      </nav>

      <Section title="Featured Cars" href="/search">
        {/* Exactly three across, measured from the column rather than the
            window: the app is capped at 480px on a desktop, so 100vw alone
            would size these for a monitor and show one and a half. */}
        <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FEATURED_CARS.map((c) => (
            <Link
              key={c.id}
              href={featuredHref(c)}
              className="press glass-card w-[calc((min(100vw,480px)-64px)/3)] shrink-0 snap-start overflow-hidden rounded-thumb"
            >
              <span className="block h-[68px] w-full bg-foreground/[0.06]">
                {c.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.photo}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                )}
              </span>
              <span className="flex items-center gap-1 px-2 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-tight text-foreground">
                    {c.make}
                  </span>
                  <span className="block truncate text-[13px] font-bold leading-tight text-foreground">
                    {c.model}
                  </span>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--color-muted-text)]"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section title="Upcoming Events" href="/events">
        {/* A placeholder, which the spec allows, and the honest option here.
            Events are generated on demand by an AI call that needs a location,
            so there is no stored list to read -- and running that on every home
            page load would be a bill and a wait for a card nobody asked for. It
            opens /events, which asks for a place and then has real ones. */}
        <Link
          href="/events"
          className="press glass-card relative flex min-h-24 items-end overflow-hidden rounded-tile p-4"
        >
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
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
      </Section>
    </main>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[21px] font-bold text-foreground">{title}</h2>
        <Link href={href} className="press text-[15px] text-[var(--color-secondary-text)]">
          See all ›
        </Link>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

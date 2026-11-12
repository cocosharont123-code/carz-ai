import Link from "next/link";
import {
  Bot, Image as ImageIcon, Trophy, Ticket, ChevronRight, Calendar,
  Crown, Sparkles, Settings,
} from "lucide-react";
import { HomeHero } from "@/components/home/home-hero";
import { HomeSearch } from "@/components/home/home-search";
import { FeaturedCars } from "@/components/home/featured-cars";

/**
 * Home.
 *
 * A server component, and now a fully static one: it reads no session and no
 * profile. It did both only to seed the customizable hero background, which
 * has been removed. The only client islands are the search field and the
 * featured strip.
 *
 * The tab bar is not rendered here. It is the shared one in the layout, and it
 * already carries Home, Map, Scan, Hunt and Profile with the raised 64px Scan
 * circle -- the same bar this screen was specified with.
 */

/**
 * The options row, side-scrolling.
 *
 * Four were specified and four fit on screen; the rest scroll in behind them.
 * That is also what fixes a real hole: replacing the old home's full feature
 * list with four cards left /settings and /drops with no inbound link
 * anywhere in the app -- reachable only by typing the URL, and /settings
 * is where sign-out, scan mode, the theme and account deletion live.
 *
 * The first four are the ones asked for, in the order asked for.
 */
const QUICK = [
  { href: "/carzbot", Icon: Bot, title: "CarzBot" },
  { href: "/garage", Icon: ImageIcon, title: "Garage" },
  { href: "/leaderboard", Icon: Trophy, title: "Leaderboard" },
  { href: "/events", Icon: Ticket, title: "Events" },
  { href: "/pricing", Icon: Crown, title: "Memberships" },
  { href: "/drops", Icon: Sparkles, title: "Drops" },
  { href: "/settings", Icon: Settings, title: "Settings" },
] as const;

export default function Home() {
  return (
    <main className="w-full px-5 pb-6">
      <HomeHero />

      {/* Fully below the hero. It was pulled up onto the fade by -mt-3, which
          put the top of the pill over the photo. */}
      <div className="mt-3">
        <HomeSearch />
      </div>

      {/* Four across at a time, the rest a swipe away. Width is measured from
          the column rather than the window, because the app is capped at 480px
          on a desktop and 100vw alone would size these for a monitor.
      
          scroll-px-5 is what keeps the row starting on the same line as the
          search pill above it and the cards below it. The row bleeds to the
          screen edge (-mx-5) and pushes its content back in (px-5), but snap
          points are measured against the scrollport rather than the padding
          box -- so without it the first tile snapped flush to the edge of the
          screen after any flick, 20px left of everything else on the page. */}
      <nav
        aria-label="Quick actions"
        className="-mx-5 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {QUICK.map(({ href, Icon, title }) => (
          <Link
            key={href}
            href={href}
            // §2: glass-lite, not glass. Nine of these in one scrolling row is
            // nine live backdrop filters against a budget of six for the whole
            // screen.
            className="press glass-lite flex min-h-20 w-[calc((min(100vw,480px)-76px)/4)] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-tile p-2.5"
          >
            <Icon className="h-[26px] w-[26px] shrink-0 text-foreground" strokeWidth={1.75} aria-hidden />
            {/* truncate, because the card is a quarter of the screen and
                "Leaderboard" at 14px bold is wider than that -- it was running
                out through the side of its own tile. */}
            <span className="w-full truncate text-center text-[13px] font-semibold leading-tight text-foreground">
              {title}
            </span>
          </Link>
        ))}
      </nav>

      {/* Their own spots, with the photo from the scan. It was a hardcoded
          list pointing at stock files that are not in this repo, which is why
          no picture ever loaded -- there was nothing to load. */}
      <Section title="Your Spots" href="/garage">
        <FeaturedCars />
      </Section>

      <Section title="Upcoming Events" href="/events">
        {/* No scrim over it. §7 puts a bottom gradient on a card only when
            text or glass sits on a photo, and there is no photo here -- the
            black gradient was painting over a glass card, which in light mode
            left the second line grey-on-grey and unreadable.

            A placeholder, which the spec allows, and the honest option here.
            Events are generated on demand by an AI call that needs a location,
            so there is no stored list to read -- and running that on every home
            page load would be a bill and a wait for a card nobody asked for. It
            opens /events, which asks for a place and then has real ones. */}
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
    <section className="mt-5">
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

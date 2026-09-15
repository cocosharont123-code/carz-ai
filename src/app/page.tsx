import Link from "next/link";
import { EXPLORE_BUBBLES } from "@/config/explore";
import { CARZ_PLUS, CARZ_MAX, carzPlusMonthly, carzMaxMonthly } from "@/lib/plans";

/**
 * The launch homepage.
 *
 * Everything it says about the app comes from config the app itself uses —
 * the feature list is the same EXPLORE_BUBBLES the menu renders, the price is
 * the same CARZ_PLUS the pricing page bills from — so a marketing page cannot
 * quietly start advertising something the product no longer does.
 */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-10">
      {/* Hero. The headline and nothing else — the release eyebrow and the
          paragraph under it are gone, so the tiles come straight off the type
          rather than sitting two blocks below it. */}
      <section className="text-center">
        <h1 className="display text-6xl leading-[0.95] sm:text-7xl md:text-8xl">
          Snap any car.
          <br />
          Know everything.
        </h1>
      </section>

      {/* What it does — the app's own feature list, not a second copy of it. */}
      <section className="mt-8 sm:mt-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EXPLORE_BUBBLES.map((item) => {
            const Icon = item.icon;
            // Eight tiles divide evenly at both two and four columns, so
            // nothing has to stretch to fill a row any more.
            return (
              <Link
                key={item.label}
                href={item.href}
                className="press glass-card flex flex-col gap-2 rounded-2xl p-4"
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="text-[13px] font-semibold leading-tight">{item.label}</span>
                <span className="text-[11px] leading-snug opacity-60">{item.description}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Membership */}
      <section className="mt-20 grid gap-4 sm:grid-cols-2">
        <div className="glass-card flex flex-col rounded-3xl p-7">
          <p className="util-label text-carz">{CARZ_PLUS.name}</p>
          <h2 className="display mt-2 text-4xl">
            {carzPlusMonthly()}
            <span className="text-xl opacity-60"> / month</span>
          </h2>
          <p className="mt-2 text-[13px] opacity-60">{CARZ_PLUS.blurb}</p>
          <ul className="mt-6 flex-1 space-y-2.5 text-left">
            {CARZ_PLUS.perks.map((p) => (
              <li key={p.title} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-carz" />
                <span className="opacity-90">{p.title}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/pricing"
            className="press glass-card mt-7 rounded-full py-3 text-center text-sm font-bold"
          >
            Get {CARZ_PLUS.name}
          </Link>
        </div>

        {/* MAX is Carz+ and then some, so it says so rather than repeating the
            four lines above it — a list that restates the cheaper tier makes
            the difference between them harder to see, not easier. */}
        <div className="glass-card relative flex flex-col rounded-3xl p-7 ring-1 ring-white/20">
          <p className="util-label text-rank-1">{CARZ_MAX.name}</p>
          <h2 className="display mt-2 text-4xl">
            {carzMaxMonthly()}
            <span className="text-xl opacity-60"> / month</span>
          </h2>
          <p className="mt-2 text-[13px] opacity-60">{CARZ_MAX.blurb}</p>
          <p className="mt-6 text-[13px] font-semibold">
            Everything in {CARZ_PLUS.name}, plus:
          </p>
          <ul className="mt-3 flex-1 space-y-2.5 text-left">
            {CARZ_MAX.perks.map((p) => (
              <li key={p.title} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rank-1" />
                <span className="opacity-90">{p.title}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/pricing"
            className="press mt-7 rounded-full bg-white py-3 text-center text-sm font-bold text-neutral-900 transition hover:opacity-90"
          >
            Get {CARZ_MAX.name}
          </Link>
        </div>
      </section>

    </main>
  );
}

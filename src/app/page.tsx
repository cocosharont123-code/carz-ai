import Link from "next/link";
import ShiftingCountdown, { RELEASE_LABEL } from "@/components/ui/countdown-timer";
import { EXPLORE_BUBBLES } from "@/config/explore";
import { CARZ_PLUS, carzPlusMonthly } from "@/lib/plans";

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
      {/* Hero */}
      <section className="text-center">
        <p className="util-label text-carz">On the App Store {RELEASE_LABEL}</p>
        <h1 className="display mt-4 text-6xl leading-[0.95] sm:text-7xl md:text-8xl">
          Snap any car.
          <br />
          Know everything.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed opacity-70">
          Point your camera at a car and get the make, model, year, specs, rarity and what
          it&apos;s worth — in seconds.
        </p>
      </section>

      {/* Countdown */}
      <section className="mt-12" aria-label={`Countdown to ${RELEASE_LABEL}`}>
        <div className="glass-card mx-auto max-w-3xl rounded-3xl px-2 py-2 sm:px-6">
          {/* Days, hours and minutes — seconds on a launch this far out is a
              twitching digit nobody reads. */}
          <ShiftingCountdown units={["Day", "Hour", "Minute"]} />
        </div>
        <p className="mt-5 text-center text-[13px] opacity-60">
          Until Carz AI lands on the App Store.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/feed"
            className="press rounded-full bg-white px-7 py-3 text-sm font-bold text-neutral-900 transition hover:opacity-90"
          >
            Use it on the web now
          </Link>
          <Link
            href="/spot"
            className="press glass-card rounded-full px-7 py-3 text-sm font-bold transition"
          >
            Scan a car
          </Link>
        </div>
      </section>

      {/* What it does — the app's own feature list, not a second copy of it. */}
      <section className="mt-20">
        <h2 className="util-label text-center opacity-60">Everything in Carz</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {EXPLORE_BUBBLES.map((item) => {
            const Icon = item.icon;
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

      {/* Carz+ */}
      <section className="mt-20">
        <div className="glass-card rounded-3xl p-8 text-center sm:p-10">
          <p className="util-label text-carz">Carz+</p>
          <h2 className="display mt-3 text-4xl sm:text-5xl">
            {carzPlusMonthly()}
            <span className="text-2xl opacity-60"> / month</span>
          </h2>
          <ul className="mx-auto mt-7 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-3 text-left sm:grid-cols-2">
            {CARZ_PLUS.perks.map((p) => (
              <li key={p.title} className="flex items-start gap-2.5 text-[13px]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-carz" />
                <span className="opacity-90">{p.title}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/pricing"
            className="press mt-8 inline-flex rounded-full bg-white px-7 py-3 text-sm font-bold text-neutral-900 transition hover:opacity-90"
          >
            See Carz+
          </Link>
        </div>
      </section>
    </main>
  );
}

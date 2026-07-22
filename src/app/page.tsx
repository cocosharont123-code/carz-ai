import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button, Card, CarPhoto, Eyebrow, StatRow } from "@/components/ui/editorial";
import { HomeFilterBar, LiveAuctions } from "@/components/home/home-sections";

const IMG = {
  hero: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80",
  featured: "https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=1400&q=80",
  action: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80",
};

const BRANDS = [
  { name: "Porsche", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80" },
  { name: "Ferrari", img: "https://images.unsplash.com/photo-1592198084033-aade902d1aae?auto=format&fit=crop&w=800&q=80" },
  { name: "Lamborghini", img: "https://images.unsplash.com/photo-1526726538690-5cbf956ae2fd?auto=format&fit=crop&w=800&q=80" },
  { name: "BMW", img: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80" },
];

const SPECS = [
  ["Engine", "5.7L V10"],
  ["0–60 mph", "3.5 s"],
  ["Top speed", "205 mph"],
  ["Production", "2004–2007"],
];

export default function Home() {
  return (
    <div className="w-full overflow-x-clip">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-5">
        {/* ---------- HERO ---------- */}
        <section className="border-b border-white/10 py-12 sm:py-16">
          <Eyebrow yellow>Spot. Identify. Bid.</Eyebrow>
          <h1 className="display mt-4 text-[3.4rem] leading-[0.88] sm:text-8xl md:text-[8.5rem]">
            Know every
            <br />
            car on the
            <br />
            <span className="text-carz">street.</span>
          </h1>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div className="aspect-[16/10] w-full overflow-hidden border border-white/10">
              <CarPhoto src={IMG.hero} alt="Featured car" />
            </div>
            <div>
              <p className="max-w-sm text-sm leading-relaxed text-white/60">
                Snap any car and instantly get its make, model, year, value and rarity — then list it,
                bid on it, or hunt it down for a bounty. Unlimited and free.
              </p>
              <Button href="/spot" size="lg" className="mt-6 w-full sm:w-auto">
                Start spotting →
              </Button>
            </div>
          </div>

          <div className="mt-8">
            <HomeFilterBar />
          </div>
        </section>

        {/* ---------- EDITORIAL GRID: SPOT OF THE WEEK ---------- */}
        <section className="py-12">
          <div className="grid grid-cols-1 border border-white/10 md:grid-cols-3">
            <div className="border-b border-white/10 md:col-span-2 md:border-b-0 md:border-r">
              <div className="aspect-[16/10] w-full overflow-hidden">
                <CarPhoto src={IMG.featured} alt="Spot of the week" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="border-b border-white/10 p-6">
                <Eyebrow yellow>Spot of the week</Eyebrow>
                <h2 className="display mt-3 text-4xl">Porsche Carrera GT</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/55">
                  The analog hypercar. A screaming V10 lifted from a stillborn Le Mans program, a carbon
                  monocoque, and no driver aids to hide behind.
                </p>
              </div>
              <div className="border-b border-white/10 p-6">
                <Eyebrow>Key specs</Eyebrow>
                <dl className="mt-3 space-y-2">
                  {SPECS.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between border-b border-white/5 pb-2">
                      <dt className="util-label text-white/45">{k}</dt>
                      <dd className="text-sm font-semibold text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="aspect-[16/9] w-full overflow-hidden">
                <CarPhoto src={IMG.action} alt="Action shot" />
              </div>
            </div>
          </div>
        </section>

        {/* ---------- STATS BAND ---------- */}
        <section className="grid grid-cols-1 gap-px border border-white/10 bg-white/10 sm:grid-cols-3">
          <StatRow value="12,480" label="Spots logged" />
          <StatRow value="98%" label="ID accuracy" yellow />
          <StatRow value="340" label="Auctions completed" />
        </section>

        {/* ---------- BROWSE BY BRAND ---------- */}
        <section className="py-12">
          <div className="mb-5 flex items-end justify-between border-b border-white/10 pb-3">
            <h2 className="display text-3xl">Browse by brand</h2>
            <Eyebrow>Marques</Eyebrow>
          </div>
          <div className="grid grid-cols-2 gap-px border border-white/10 bg-white/10 lg:grid-cols-4">
            {BRANDS.map((b) => (
              <Link key={b.name} href="/auctions" className="group relative aspect-[4/5] overflow-hidden bg-black">
                <CarPhoto src={b.img} alt={b.name} className="absolute inset-0" />
                <span className="absolute left-3 top-3 bg-black/75 px-2 py-1 display text-xl">{b.name}</span>
                <span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-black text-lg text-white transition-colors group-hover:bg-carz group-hover:text-carz-ink">
                  ↗
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- LIVE AUCTIONS ---------- */}
        <section className="py-12">
          <div className="mb-5 flex items-end justify-between border-b border-white/10 pb-3">
            <h2 className="display text-3xl">Live auctions</h2>
            <Button href="/auctions" variant="ghost" size="sm">
              View all →
            </Button>
          </div>
          <LiveAuctions />
        </section>

        {/* ---------- LEADERBOARD TEASER ---------- */}
        <section className="py-12">
          <Card className="flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
            <div>
              <Eyebrow yellow>The board</Eyebrow>
              <h2 className="display mt-3 text-4xl">Rarest cars spotted</h2>
              <p className="mt-2 max-w-md text-sm text-white/55">
                Every rare car identified across Carz AI, ranked by rarity. Spot something exotic and take
                the top slot.
              </p>
            </div>
            <Button href="/leaderboard" size="lg">
              See the rankings →
            </Button>
          </Card>
        </section>
      </main>

      {/* ---------- FOOTER ---------- */}
      <footer className="border-t border-white/10 px-5 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
          <span className="display text-lg">Carz AI</span>
          <span className="util-label text-white/40">Everything free · No limits</span>
        </div>
      </footer>
    </div>
  );
}

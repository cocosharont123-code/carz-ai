import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SparklesCore } from "@/components/ui/sparkles";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { ShaderSection } from "@/components/shader-section";
import { WebGLShader } from "@/components/ui/web-gl-shader";
import { HeroCTA } from "@/components/hero-cta";

export default function Home() {
  return (
    <>
      {/* Full-screen WebGL shader background (fixed) */}
      <WebGLShader />

      {/* All content sits above the shader */}
      <div className="relative z-10">
        <SiteHeader />

        {/* Hero over the shader */}
        <section className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
          <h1 className="text-6xl font-extrabold tracking-tighter text-white sm:text-7xl md:text-8xl">
            Carz AI
          </h1>
          <p className="mt-4 max-w-xl text-sm text-white/60 md:text-lg">
            Snap any car and instantly know the make, model, year, value, rarity and where to
            buy one.
          </p>
          <div className="my-8 flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <p className="text-xs text-green-500">AI vision online</p>
          </div>
          <HeroCTA />
        </section>

        {/* Below-hero content: same flat black as everything else */}
        <div className="relative bg-background">
          {/* Scroll-animation showcase */}
          <section>
            <ContainerScroll
              titleComponent={
                <h2 className="text-3xl font-semibold text-foreground">
                  The whole story of any car <br />
                  <span className="mt-1 block text-4xl font-bold leading-none md:text-[5rem]">
                    from one photo
                  </span>
                </h2>
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1698669632639-76229771a1a9?auto=format&fit=crop&w=1400&q=80"
                alt="Bugatti Chiron Édition Noire — all black"
                className="mx-auto h-full w-full rounded-2xl object-cover object-center"
                draggable={false}
              />
            </ContainerScroll>
          </section>

          {/* Three.js shader showcase */}
          <ShaderSection />

          {/* Sparkles CTA band */}
          <section className="relative isolate overflow-hidden py-28">
            <div className="absolute inset-0">
              <SparklesCore
                id="cta-sparkles"
                background="transparent"
                minSize={0.5}
                maxSize={1.2}
                particleDensity={60}
                speed={1}
                className="h-full w-full"
                particleColor="#7dd3fc"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,var(--background)_80%)]" />
            <div className="relative z-10 mx-auto max-w-xl px-4 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Ready to start spotting?
              </h2>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                Snap any car and get the make, model, year, specs and more — free for your first
                two a day.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/spot"
                  className="rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-6 py-3 font-bold text-white shadow-lg transition hover:opacity-90"
                >
                  Start spotting — free
                </Link>
                <Link
                  href="/pricing"
                  className="rounded-xl border border-border bg-card px-6 py-3 font-semibold text-foreground transition hover:bg-accent"
                >
                  See plans
                </Link>
              </div>
            </div>
          </section>

          <footer className="px-5 py-12 text-center text-sm text-muted-foreground">
            Carz AI · Free, Pro &amp; Max plans ·{" "}
            <Link href="/pricing" className="underline">
              Upgrade
            </Link>
          </footer>
        </div>
      </div>
    </>
  );
}

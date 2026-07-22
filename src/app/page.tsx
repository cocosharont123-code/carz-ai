import { SiteHeader } from "@/components/site-header";
import { WebGLShader } from "@/components/ui/web-gl-shader";
import { HeroCTA } from "@/components/hero-cta";

export default function Home() {
  return (
    <div className="relative z-10 w-full overflow-x-clip">
      <SiteHeader />

      {/* Hero — the RGB shader is clipped to this section so it never bleeds
          to the page edges. */}
      <section className="relative isolate flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 text-center">
        {/* Contained WebGL shader background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WebGLShader />
        </div>

        <div className="relative z-10 flex w-full flex-col items-center">
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
        </div>
      </section>
    </div>
  );
}

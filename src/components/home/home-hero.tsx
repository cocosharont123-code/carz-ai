"use client";

import { useRouter } from "next/navigation";
import { WebGLShader } from "@/components/ui/web-gl-shader";
import { LiquidButton } from "@/components/ui/liquid-glass-button";
import { SiteHeader } from "@/components/site-header";

export function HomeHero() {
  const router = useRouter();
  return (
    <div className="relative w-full overflow-x-clip">
      <SiteHeader />
      <section className="relative isolate flex min-h-[88vh] w-full items-center justify-center overflow-hidden px-4">
        {/* Black & white WebGL shader, contained so it never bleeds to the edges */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <WebGLShader />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-3xl rounded-3xl border border-white/15 p-2">
          <main className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/45 py-12">
            <h1 className="display mb-3 text-center text-7xl md:text-[clamp(3rem,10vw,8rem)]">Carz AI</h1>
            <p className="px-6 text-center text-xs text-white/60 md:text-sm lg:text-lg">
              Snap any car and instantly know the make, model, year, value and rarity — then list it, bid on
              it, or hunt it for a bounty.
            </p>
            <div className="my-8 flex items-center justify-center gap-1.5">
              <span className="relative flex h-3 w-3 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              <p className="util-label text-white/70">AI vision online</p>
            </div>
            <div className="flex justify-center">
              <LiquidButton
                size="xl"
                onClick={() => router.push("/spot")}
                className="rounded-full border-2 border-transparent text-white [background:linear-gradient(rgba(255,255,255,0.05),rgba(255,255,255,0.05))_padding-box,linear-gradient(90deg,var(--color-neon-blue),var(--color-neon-green),var(--color-neon-red))_border-box] shadow-[0_0_26px_-6px_rgba(0,229,255,0.6)]"
              >
                Start spotting →
              </LiquidButton>
            </div>
          </main>
        </div>
      </section>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";

// WebGL canvas must load only in the browser (no SSR).
const ShaderShowcase = dynamic(() => import("./shader-showcase"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-background" />,
});

export function ShaderSection() {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16">
      <div className="relative h-[360px] w-full overflow-hidden rounded-2xl border border-border bg-background">
        <ShaderShowcase />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end p-6 text-center">
          <h3 className="text-2xl font-bold">Real-time AI, real-world cars</h3>
          <p className="mt-1 max-w-md text-sm text-white/70">
            Every spot is powered by live vision models — identification in seconds.
          </p>
        </div>
      </div>
    </section>
  );
}

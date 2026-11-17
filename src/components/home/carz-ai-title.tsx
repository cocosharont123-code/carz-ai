"use client";

import dynamic from "next/dynamic";

/**
 * The wordmark, in glass.
 *
 * A thin wrapper around the installed RefractedText component, which is left
 * exactly as it was installed -- the shader, the renderer, the glyph rounding
 * and the bundled font are its source of truth, and everything here is done
 * through props.
 *
 * Client-only, and loaded with ssr: false rather than a plain "use client".
 * The component is WebGL 2: it measures its own container, reads
 * document.fonts and sizes a canvas, none of which exist on the server. Left
 * to render on the server it would emit a span whose dimensions the browser
 * immediately disagrees with, which is a hydration warning on the one screen
 * everybody lands on. "use client" alone does not prevent that -- it still
 * prerenders.
 *
 * The placeholder is the height the canvas will take, so the hero does not
 * jump when the component arrives.
 */
const RefractedText = dynamic(
  () => import("@/components/refracted-text").then((m) => m.RefractedText),
  {
    ssr: false,
    loading: () => <span aria-hidden className="block h-[88px] w-full" />,
  },
);

/**
 * fontSize is 120px, not the 400px the preset suggests.
 *
 * The component caps its canvas at the width of its container and scales the
 * lettering to fit, so 400px is not an overflow -- it is a line that fits the
 * width and is then far taller than the hero, pushing the search field and
 * the tiles down the page. 120px fills the column on a phone with "Carz AI"
 * on one line, and the container query below lets it grow on a wider screen.
 */
export function CarzAiTitle() {
  return (
    <div style={{ containerType: "inline-size", width: "100%" }}>
      <RefractedText
        text="Carz AI"
        theme="dark"
        topColor="auto"
        bottomColor="auto"
        beamColor="auto"
        spectrumWarmColor="auto"
        spectrumMiddleColor="auto"
        spectrumCoolColor="auto"
        reveal={false}
        animateBeam={false}
        openingDuration={6.9}
        duration={13.2}
        intensity={1.2}
        dispersion={1}
        colorIntensity={1}
        beamPosition={0.5}
        fixedBeam={false}
        paused={false}
        cursorMovesBeam={false}
        fontSize="min(120px, 26cqw)"
        fontFamily="'ReactDrops Square Display', 'Arial Black', sans-serif"
        fontWeight={900}
        letterSpacing="normal"
        extraBold={2.25}
        fontHeight={80}
        cornerRounding={1}
      />
    </div>
  );
}

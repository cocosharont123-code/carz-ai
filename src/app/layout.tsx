import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { BackButton } from "@/components/back-button";
import { AppChrome } from "@/components/app-chrome";

/**
 * No downloaded webfont.
 *
 * Inter was here via next/font/google, which fetches the font files at build
 * time. That made every deploy depend on fonts.googleapis.com being reachable
 * from the build container, and it twice was not: two production deploys failed
 * on "Module not found: inter.module.css" while nothing in the app had changed.
 * A build that fails at random is worse than one that fails consistently,
 * especially the week before a launch.
 *
 * The cost of dropping it is small and lands only off-Apple. -apple-system and
 * SF Pro Display win on every iPhone and Mac, so Inter never rendered there at
 * all; Android and Windows fall back to Roboto and Segoe, which is a slightly
 * different sans and not a broken page.
 *
 * To get Inter back without the network: put the woff2 files in /public and use
 * next/font/local, which reads from disk at build time and cannot fail this way.
 */

export const metadata: Metadata = {
  title: "Carz AI — snap a car, know everything",
  description:
    "Point your camera at any car and instantly get the make, model, year, specs, valuation and nearby hotspots.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Carz AI",
    statusBarStyle: "black-translucent",
  },
  // No `icon` entry: app/favicon.ico is picked up by file convention and is
  // drawn for tab sizes, where the full wave would be an illegible smudge.
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="bg-background">
        <script
          dangerouslySetInnerHTML={{
            /* Applies the saved theme before first paint.
               
               Inline and synchronous on purpose: anything that runs after
               hydration paints the wrong theme first, which is the white flash
               every app with a dark mode gets wrong. "system" follows the OS
               and is the default, so a phone in dark mode opens dark without
               anyone choosing anything. */
            __html: `try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.classList.toggle('light',!d);}catch(e){document.documentElement.classList.add('dark');}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            /* §4. The shell is sized from the visual viewport, so opening the
               keyboard shrinks it rather than scrolling the document under a
               fixed bar. Runs once and then only on resize; no scroll
               listener, nothing that touches React state. */
            __html: `(function(){var v=window.visualViewport;function s(){document.documentElement.style.setProperty('--vvh',(v?v.height:window.innerHeight)+'px');}if(v){v.addEventListener('resize',s,{passive:true});}s();})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            /* §2. Glass kill switch for devices that will not keep 120fps with
               live backdrop filters. Set before paint, so nothing blurs and
               then un-blurs. */
            __html: `try{var n=navigator;if((n.hardwareConcurrency&&n.hardwareConcurrency<4)||(n.deviceMemory&&n.deviceMemory<4)){document.documentElement.setAttribute('data-glass','lite');}}catch(e){}`,
          }}
        />
        {/* The cyan gradient bars that used to sit behind every page are gone.
            The background is #000, flat. */}
        {/* §4. The shell: fixed height, no scroll of its own. The page's own
            <main> is the single scroller, positioned absolutely inside this by
            a global rule.

            The old shell made the body the scroller and kept the column one
            pixel taller than the viewport on purpose, to settle Safari's
            toolbar before first paint. That worked, and it also meant every
            screen had a pixel of scroll it did not need, with spacers and
            rounding on top of it. A fixed shell with an inner scroller settles
            the toolbar the same way and cannot accumulate stray height. */}
        <div
          id="app"
          className="relative mx-auto w-full max-w-[480px]"
        >
          <Providers>
            <BackButton />
            {children}
            <AppChrome />
          </Providers>
        </div>
      </body>
    </html>
  );
}

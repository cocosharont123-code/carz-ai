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
      <body className="min-h-full flex flex-col bg-background ">
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
        {/* The cyan gradient bars that used to sit behind every page are gone.
            The background is #000, flat. */}
        {/* Exactly the viewport, not a pixel more.

            It used to be 100dvh+1px so that Safari's bottom toolbar was already
            slid in at first paint and could not shift the docked nav when a
            short page later grew. The cost was that every page in the app
            scrolled by one pixel, which is the stray scroll on screens that
            should not move at all. The jump it prevented is the lesser of the
            two, and only on Safari, and only on pages that start short. */}
        {/* The app is a 480px column, centred, with black either side of it.
            Applied once here rather than screen by screen: a page that sets its
            own max-w-2xl inside this is simply capped at 480, so the pages not
            yet rebuilt get the desktop frame too. */}
        <div
          className="relative z-10 mx-auto flex w-full max-w-[480px] min-h-[100dvh] flex-1 flex-col"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          {/* Inside Providers on purpose: the nav reads the session, and being
              a child of the legal gate means it stays hidden behind the blocking
              terms screen rather than floating over it. After the children, not
              before: the bar is fixed to the bottom and the spacer it renders
              has to come last in the flow to hold the page clear of it. */}
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

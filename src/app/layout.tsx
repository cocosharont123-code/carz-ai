import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { BackButton } from "@/components/back-button";
import { AppChrome } from "@/components/app-chrome";

/**
 * Inter, behind the system stack.
 *
 * The spec asks for -apple-system, then SF Pro Display, then Inter. On Apple
 * hardware the first two win and this never downloads a byte; it is the
 * fallback for everything else, so Android and Windows stop rendering the app
 * in Roboto and Segoe. Variable, so 400 through 900 is one file rather than
 * six, and swapped rather than blocked so no text waits on it.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-inter",
  fallback: ["-apple-system", "BlinkMacSystemFont", "sans-serif"],
});

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
    <html lang="en" suppressHydrationWarning className={`dark h-full antialiased ${inter.variable}`}>
      <body className="min-h-full flex flex-col bg-background ">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{localStorage.removeItem('theme');document.documentElement.classList.remove('light');document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
        {/* The cyan gradient bars that used to sit behind every page are gone.
            The background is #000, flat. */}
        {/* min-height one pixel past the viewport, on purpose.
            
            Safari slides its bottom toolbar in the moment a page becomes tall
            enough to scroll, and that shrinks the visual viewport — which a
            position:fixed bottom element correctly follows by moving up. So a
            page that loads short and then grows makes the nav jump, which is
            what opening Garage did: the member check renders one line of text,
            then the gallery arrives and the page is suddenly scrollable.
            
            Being scrollable from the first paint means the toolbar is already
            where it is going to be, so nothing moves when the content lands.
            One pixel is not reachable by a drag — body already sets
            overscroll-behavior-y: none — it only settles the toolbar. */}
        {/* The app is a 480px column, centred, with black either side of it.
            Applied once here rather than screen by screen: a page that sets its
            own max-w-2xl inside this is simply capped at 480, so the pages not
            yet rebuilt get the desktop frame too. */}
        <div
          className="relative z-10 mx-auto flex w-full max-w-[480px] min-h-[calc(100dvh+1px)] flex-1 flex-col"
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

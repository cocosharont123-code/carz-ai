import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { GlobalShaderBg } from "@/components/global-shader-bg";
import { BottomNav } from "@/components/bottom-nav";
import { BackButton } from "@/components/back-button";
import { LegalNotice } from "@/components/legal-notice";

// UI type is the Apple system font stack (no downloaded Google Fonts).

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
    <html lang="en" suppressHydrationWarning className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-background ">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{localStorage.removeItem('theme');document.documentElement.classList.remove('light');document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
        <GlobalShaderBg />
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
        <div
          className="relative z-10 flex min-h-[calc(100dvh+1px)] flex-1 flex-col"
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
            <LegalNotice />
            <BottomNav />
          </Providers>
        </div>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { GlobalGradientBg } from "@/components/global-gradient-bg";
import { TopNav } from "@/components/TopNav";

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
  icons: {
    icon: "/icon-512.png",
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
      <body className="min-h-full flex flex-col ">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{localStorage.removeItem('theme');document.documentElement.classList.remove('light');document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
        <GlobalGradientBg />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          {/* Inside Providers on purpose: TopNav reads the session, and being a
              child of the Terms gate means it stays hidden behind the blocking
              terms screen rather than floating over it. */}
          <Providers>
            <TopNav />
            {children}
          </Providers>
        </div>
      </body>
    </html>
  );
}

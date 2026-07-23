import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { GlobalShaderBg } from "@/components/global-shader-bg";

// UI type is the Apple system font stack (no downloaded Google Fonts).

export const metadata: Metadata = {
  title: "Car Spotter — snap a car, know everything",
  description:
    "Point your camera at any car and instantly get the make, model, year, specs, valuation and nearby hotspots.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Car Spotter",
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
      <body className="min-h-full flex flex-col bg-background ">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{localStorage.removeItem('theme');document.documentElement.classList.remove('light');document.documentElement.classList.add('dark');}catch(e){}`,
          }}
        />
        <GlobalShaderBg />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchPill } from "@/components/ui/editorial";
import { HomeWidgets } from "@/components/home/home-widgets";

/**
 * Home.
 *
 * Also the app's index. The tab bar carries five destinations and no menu, so
 * the list that used to live behind the hamburger lives here -- four tiles for
 * the things worth a tile, then every remaining feature as a row. Nothing the
 * app can do is reachable only by typing a URL.
 */

/**
 * Home is the widget grid.
 *
 * The rows and the four tiles before them are gone. Every destination they
 * carried is a widget now, which keeps the rule that nothing in the app is
 * reachable only by typing a URL -- and the widgets show real figures where
 * there are any instead of only naming the feature.
 */

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-6">
      {/* Wordmark only. The mockup puts a bell beside it for car alerts and
          there is no alerts feature to open, so there is no bell. */}
      <header className="flex h-14 items-center">
        <span className="text-[20px] font-bold lowercase tracking-tight text-foreground">carz</span>
      </header>

      <Hero />

      <SearchPill
        className="mt-6"
        value={q}
        onChange={setQ}
        onSubmit={() => {
          const term = q.trim();
          if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
        }}
        placeholder="Search any car..."
        label="Search any car"
      />

      <HomeWidgets />

    </main>
  );
}

/**
 * The headline over a photo that fades into black.
 *
 * The image is a plain background-image rather than next/image: if /hero.jpg is
 * not there the element is simply black, where a missing <img> is a broken-image
 * glyph. The spec asks for black, never a broken image, and this is the version
 * that cannot break.
 *
 * The fade is the one gradient the spec allows, and it has to reach full black
 * at the bottom or the type sits on a grey seam.
 */
function Hero() {
  return (
    <section className="relative -mx-5 mt-2 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 bg-background bg-cover bg-center"
        style={{ backgroundImage: "url('/hero.jpg')" }}
      />
      <div
        aria-hidden
        // Fades into the page, not into black: on a white page a black
        // gradient would be a dark band under the headline.
        className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background"
      />
      <h1 className="relative px-5 pb-10 pt-16 text-left text-[50px] font-black leading-[0.95] tracking-[-0.02em]">
        <span className="block text-foreground">SNAP</span>
        <span className="block text-foreground">ANY CAR.</span>
        <span className="block text-[var(--color-hero-2)]">KNOW</span>
        <span className="block text-[var(--color-hero-2)]">EVERYTHING.</span>
      </h1>
    </section>
  );
}

import Link from "next/link";
import { User } from "lucide-react";
import { auth } from "@/auth";
import { getProfile } from "@/lib/profile-blob";
import { HomeHero } from "@/components/home/home-hero";
import {
  FeaturedCars,
  HomeSearch,
  QuickActions,
  UpcomingEvents,
} from "@/components/home/home-sections";

/**
 * Home.
 *
 * A server component so the chosen hero photo is read from the profile before
 * anything paints — fetching it after mount would show the default first and
 * swap, which is the flash the brief rules out. Everything below the hero that
 * needs state is a client island.
 *
 * The header floats over the hero rather than sitting above it, so the photo
 * runs to the top of the screen under the status bar.
 */
export default async function HomePage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const profile = email ? await getProfile(email) : null;

  return (
    <main className="relative px-5 pb-6">
      {/* Over the hero, not in the flow above it. */}
      <header className="absolute inset-x-5 top-3 z-20 flex items-center justify-between">
        <span className="text-[40px] font-bold lowercase leading-none tracking-[-0.03em] text-white">
          carz
        </span>
        <Link
          href="/profile"
          aria-label="Profile"
          className="press flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-black/20 backdrop-blur-md"
        >
          <User className="h-[18px] w-[18px] text-white" strokeWidth={2} aria-hidden />
        </Link>
      </header>

      <HomeHero initialPhoto={profile?.homeHeroPhoto ?? ""} canCustomize={!!profile} />

      {/* Sits on the fade, pulled up over the bottom of the hero. */}
      <div className="relative z-10 -mt-4">
        <HomeSearch />
      </div>

      <div className="mt-5">
        <QuickActions />
      </div>

      <div className="mt-7">
        <FeaturedCars />
      </div>

      <div className="mt-7">
        <UpcomingEvents />
      </div>
    </main>
  );
}

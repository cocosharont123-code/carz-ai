import Link from "next/link";
import { Home, Compass } from "lucide-react";

/**
 * 404.
 *
 * Built from the supplied component's structure -- the oversized numeral
 * fading out, the two-line explanation, Go Home beside Explore -- using this
 * app's own kit rather than the shadcn Empty and Button it imported. Those
 * needed class-variance-authority and @radix-ui/react-slot, neither of which
 * is installed, and Empty is four divs: two new dependencies to avoid writing
 * eight lines is not a trade worth making.
 *
 * Next renders app/not-found.tsx for any unmatched route, so this replaces the
 * framework's default page everywhere rather than being a component something
 * has to remember to use.
 *
 * "Explore" goes to /search. The mockup's second button is a browse
 * destination and this app's is search -- there is no /explore route, and a
 * button pointing at a 404 from a 404 would be its own joke.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-[480px] flex-col items-center justify-center px-5 py-24 text-center">
      {/* Masked so the numeral fades out rather than stopping, which is what
          keeps it from reading as a headline. */}
      <p
        aria-hidden
        className="bg-gradient-to-b from-foreground to-transparent bg-clip-text text-[120px] font-black leading-none tracking-tight text-transparent"
      >
        404
      </p>

      <h1 className="sr-only">Page not found</h1>

      <p className="-mt-4 text-[15px] leading-relaxed text-[var(--color-secondary-text)]">
        The page you&apos;re looking for might have been
        <br />
        moved or doesn&apos;t exist.
      </p>

      <div className="mt-8 flex w-full gap-3">
        <Link
          href="/"
          className="press flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-carz text-[15px] font-semibold text-carz-ink"
        >
          <Home className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          Go home
        </Link>
        <Link
          href="/search"
          className="press glass-card flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full border-[var(--line-button)] text-[15px] font-semibold"
        >
          <Compass className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          Explore
        </Link>
      </div>
    </main>
  );
}

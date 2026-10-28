"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";

/**
 * The furniture under every page: the nav.
 *
 * Hidden on the sign-in flow, which is the reason this component exists. A tab
 * bar on a sign-in screen is five taps that all go nowhere.
 *
 * Gated here rather than inside BottomNav. That component reaches its first
 * return past a dozen hooks, and a bail-out added above them is the kind of
 * edit that works until someone adds a hook underneath it.
 *
 * The standing legal line used to render here too, above the nav. §4 made
 * <main> absolutely positioned, which took it out of #app's flow -- and that
 * left the notice as the first in-flow child, so it painted at the TOP of
 * every screen, across the page's own title. There is no longer a "after the
 * page content" slot out here to put it back into: main is the only scroller
 * and the chrome sits outside it.
 *
 * It is dropped rather than pinned above the nav, because pinning it costs
 * every screen ~30px of permanent furniture and pushes fitting screens into
 * scrolling. Acceptance is not lost with it: signing in is mandatory for the
 * whole app now, and the sign-in screen carries an explicit consent line above
 * the button with both documents linked -- so every user agrees on the way in,
 * which is a stronger record than browsewrap was. Both documents stay linked
 * from Settings.
 */
export function AppChrome() {
  const pathname = usePathname();
  if (pathname.startsWith("/signin")) return null;

  return <BottomNav />;
}

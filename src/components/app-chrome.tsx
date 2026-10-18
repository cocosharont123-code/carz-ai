"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";

/**
 * The furniture under every page: the standing legal line, then the nav.
 *
 * Both are hidden on the sign-in flow, which is the reason this component
 * exists. A tab bar on a sign-in screen is five taps that all go nowhere, and
 * the nav also renders the spacer that holds pages clear of it — so leaving it
 * mounted would cost a full-height screen exactly one nav's worth of height and
 * make it scroll.
 *
 * Gated here rather than inside each one. BottomNav reaches its first return
 * past a dozen hooks, and a bail-out added above them is the kind of edit that
 * works until someone adds a hook underneath it.
 *
 * Order is load-bearing: the nav is fixed to the bottom and the spacer it
 * renders has to come last in the flow.
 */
export function AppChrome() {
  const pathname = usePathname();
  if (pathname.startsWith("/signin")) return null;

  /**
   * The standing "by using Carz AI you agree" line is gone from every page.
   *
   * It was browsewrap: nobody was stopped, and the terms bound by use. That was
   * the only thing binding anyone while the app could be browsed signed out.
   * The wall changed it — nothing is reachable without a session now, so every
   * single person passes the sign-in screen, which states acceptance above the
   * button they press. Acceptance is captured there, once, instead of restated
   * under every screen. Both documents stay linked from Settings and both URLs
   * stay public.
   */
  return <BottomNav />;
}

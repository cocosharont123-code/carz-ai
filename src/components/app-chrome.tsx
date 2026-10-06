"use client";

import { usePathname } from "next/navigation";
import { LegalNotice } from "@/components/legal-notice";
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
   * Full-bleed pages get the nav but not the standing legal line.
   *
   * The line is a paragraph in the flow, so on a page already sized to the
   * whole viewport it is pure extra height -- which is the stray scroll on the
   * map. The notice still appears under every page that scrolls anyway, which is
   * every other one, so nothing stops binding by use.
   */
  const fullBleed = pathname.startsWith("/map");

  return (
    <>
      {!fullBleed && <LegalNotice />}
      <BottomNav />
    </>
  );
}

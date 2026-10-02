"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/editorial";
import {
  carzPlusMonthly,
  carzPlusAnnual,
  carzPlusAnnualSaving,
  carzMaxMonthly,
  carzMaxAnnual,
  carzMaxAnnualSaving,
} from "@/lib/plans";

/**
 * Wraps members-only content. Renders the children only for members of the tier
 * asked for; everyone else gets an explanation of the locked feature and the
 * upsell for that tier.
 *
 * It only knew about Carz+ before, which left no way to lock a MAX feature on the
 * client: the MAX routes answered 402 and the screen in front of them opened for
 * any member, so a Carz+ member reached a page that then refused to load.
 */
export function MemberGate({
  children,
  title = "Members only",
  blurb,
  points,
  tabs,
  tier = "plus",
}: {
  children: ReactNode;
  title?: string;
  /** One-line summary of what the feature is. */
  blurb: string;
  /** What this locked feature actually does — explained for non-members. */
  points?: string[];
  /** Optional section tab bar, shown under the header even while locked so
   *  a sibling public tab (e.g. Leaderboard) stays reachable for non-members. */
  tabs?: ReactNode;
  /**
   * Which membership opens this. "max" requires Carz MAX specifically, so a
   * Carz+ member is shown the upsell rather than content their API will refuse.
   */
  tier?: "plus" | "max";
}) {
  const [member, setMember] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/membership", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        // tier is the one that matters for a MAX feature; `member` is true for
        // both tiers and would let Carz+ straight through.
        setMember(tier === "max" ? d.tier === "max" : !!d.member);
      })
      .catch(() => setMember(false));
  }, [tier]);

  const isMax = tier === "max";
  const planName = isMax ? "Carz MAX" : "Carz+";
  const monthly = isMax ? carzMaxMonthly() : carzPlusMonthly();
  const annual = isMax ? carzMaxAnnual() : carzPlusAnnual();
  const saving = isMax ? carzMaxAnnualSaving() : carzPlusAnnualSaving();

  if (member === null) {
    return (
      <>
        {tabs}
        {/* Holds the page's height while the membership check runs. A single
            line of text here collapsed the page to nothing and then let it
            spring back to full size a moment later, which is a reflow the
            reader sees whether or not the nav moves with it. */}
        <main
          className="mx-auto flex w-full max-w-lg items-start justify-center px-5 py-16 text-center"
          style={{ minHeight: "calc(100dvh - var(--nav-h) - var(--safe-top) - var(--back-h))" }}
        >
          <div className="util-label opacity-50">Loading…</div>
        </main>
      </>
    );
  }

  if (!member) {
    return (
      <>
        {tabs}
        <main className="mx-auto w-full max-w-lg px-5 py-16">
          <div className="glass-card rounded-card p-8 text-center">
            <div className="util-label text-carz">{planName} members only</div>
            <h1 className="display mt-2 text-3xl">{title}</h1>
            <p className="mx-auto mt-2 max-w-sm text-[15px] opacity-70">{blurb}</p>

            {points && points.length > 0 && (
              <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[15px]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-carz" />
                    <span className="opacity-90">{p}</span>
                  </li>
                ))}
              </ul>
            )}

            <Button href="/pricing" className="mt-6">
              Get {planName} · {monthly}/mo
            </Button>
            <p className="mt-3 text-xs opacity-60">
              or {annual}/year — save {saving}%
            </p>
          </div>
        </main>
      </>
    );
  }

  return <>{children}</>;
}

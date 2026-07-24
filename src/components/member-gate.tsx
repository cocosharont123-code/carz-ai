"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/editorial";

/**
 * Wraps members-only content. Renders the children only for Carz+ members;
 * everyone else gets an explanation of the locked feature plus an upsell.
 */
export function MemberGate({
  children,
  title = "Members only",
  blurb,
  points,
}: {
  children: ReactNode;
  title?: string;
  /** One-line summary of what the feature is. */
  blurb: string;
  /** What this locked feature actually does — explained for non-members. */
  points?: string[];
}) {
  const [member, setMember] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/membership", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMember(!!d.member))
      .catch(() => setMember(false));
  }, []);

  if (member === null) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-lg px-5 py-16 text-center">
          <div className="util-label opacity-50">Loading…</div>
        </main>
      </>
    );
  }

  if (!member) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-lg px-5 py-16">
          <div className="glass-card rounded-3xl p-8 text-center">
            <div className="util-label text-carz">Carz+ members only</div>
            <h1 className="display mt-2 text-3xl">{title}</h1>
            <p className="mx-auto mt-2 max-w-sm text-[13px] opacity-70">{blurb}</p>

            {points && points.length > 0 && (
              <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-[13px]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-carz" />
                    <span className="opacity-90">{p}</span>
                  </li>
                ))}
              </ul>
            )}

            <Button href="/pricing" className="mt-6">Get Carz+ · $9.99/mo</Button>
            <p className="mt-3 text-xs opacity-60">or $80/year — save 33%</p>
          </div>
        </main>
      </>
    );
  }

  return <>{children}</>;
}

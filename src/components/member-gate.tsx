"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/editorial";

/**
 * Wraps members-only content. Renders the children only for Carz+ members;
 * everyone else gets an upsell card. Mirrors the gate used on Garage/Wishlist.
 */
export function MemberGate({
  children,
  icon = "🔒",
  title = "Members only",
  blurb,
}: {
  children: ReactNode;
  icon?: string;
  title?: string;
  blurb: string;
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
        <main className="mx-auto w-full max-w-lg px-5 py-16 text-center">
          <div className="glass-card rounded-3xl p-10">
            <div className="text-4xl">{icon}</div>
            <h1 className="display mt-3 text-3xl">{title}</h1>
            <p className="mx-auto mt-2 max-w-sm text-[13px] opacity-70">{blurb}</p>
            <Button href="/pricing" className="mt-6">Get Carz+ · $9.99/mo</Button>
          </div>
        </main>
      </>
    );
  }

  return <>{children}</>;
}

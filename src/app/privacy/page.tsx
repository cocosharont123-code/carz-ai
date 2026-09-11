"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageMasthead } from "@/components/ui/editorial";
import { PrivacyReader } from "@/components/privacy-reader";
import { PRIVACY_VERSION, PRIVACY_ENTITY, PRIVACY_UPDATED } from "@/lib/privacy";
import { getPrivacyAcceptance } from "@/lib/privacy-acceptance";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The Privacy Policy as a normal page, for re-reading after acceptance. Anyone
 * who hasn't accepted never reaches this: the gate in Providers replaces the
 * whole app, this page included, until they have.
 */
export default function PrivacyPage() {
  const [acceptedAt, setAcceptedAt] = useState<number | null>(null);

  useEffect(() => {
    Promise.resolve(getPrivacyAcceptance()).then((stored) => {
      if (stored) setAcceptedAt(stored.at);
    });
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <PageMasthead
        eyebrow={`${PRIVACY_ENTITY} · updated ${PRIVACY_UPDATED}`}
        title="Privacy Policy"
      />

      {acceptedAt && (
        <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-neon-green/30 bg-neon-green/[0.07] px-4 py-3">
          <ShieldCheck className="h-4 w-4 shrink-0 text-neon-green" strokeWidth={2} aria-hidden />
          <p className="text-[13px] font-semibold">
            You accepted this policy on {fmtDate(acceptedAt)}.
          </p>
        </div>
      )}

      <div className="mt-5">
        {/* Already accepted, so no second Accept button: the gate is the one
            place acceptance is given. */}
        <PrivacyReader showAccept={!acceptedAt} onAccepted={setAcceptedAt} />
      </div>

      <p className="mt-8 text-center text-[11px] uppercase tracking-wide opacity-40">
        <Link href="/terms" className="hover:opacity-80">
          Read the Terms of Service
        </Link>
        {" · "}
        version {PRIVACY_VERSION}
      </p>
    </main>
  );
}

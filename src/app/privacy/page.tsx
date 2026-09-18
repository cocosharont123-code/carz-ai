"use client";

import Link from "next/link";
import { PageMasthead } from "@/components/ui/editorial";
import { PrivacyReader } from "@/components/privacy-reader";
import { PRIVACY_VERSION, PRIVACY_ENTITY, PRIVACY_UPDATED } from "@/lib/privacy";

/**
 * The Privacy Policy, to read. Nothing to accept: it was never a bargain to
 * strike, and the notice under every page covers the agreement.
 */
export default function PrivacyPage() {

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <PageMasthead
        eyebrow={`${PRIVACY_ENTITY} · updated ${PRIVACY_UPDATED}`}
        title="Privacy Policy"
      />


      <div className="mt-5">
        {/* Already accepted, so no second Accept button: the gate is the one
            place acceptance is given. */}
        <PrivacyReader showAccept={false} />
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

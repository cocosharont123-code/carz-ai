"use client";

import Link from "next/link";
import { PageMasthead } from "@/components/ui/editorial";
import { TermsReader } from "@/components/terms-reader";
import { TERMS_VERSION, TERMS_ENTITY } from "@/lib/terms";

/**
 * The Terms, to read. Nothing to accept: they bind by use now, and the notice
 * under every page says so.
 */
export default function TermsPage() {

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <PageMasthead
          eyebrow={`${TERMS_ENTITY} · version ${TERMS_VERSION}`}
          title="Terms of Service"
        />

  
        <div className="mt-5">
          {/* Already accepted, so no second Accept button — the gate is the one
              place acceptance is given. */}
          <TermsReader showAccept={false} />
        </div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-wide opacity-40">
          <Link href="/spot" className="hover:opacity-80">
            Back to spotting
          </Link>
        </p>
      </main>
    </>
  );
}

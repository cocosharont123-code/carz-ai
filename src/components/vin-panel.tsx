"use client";

import { ShieldCheck, ShieldAlert, Wrench } from "lucide-react";
import type { VinFacts } from "@/lib/vin";
import { cn } from "@/lib/utils";

/**
 * What the seventeen characters themselves said, shown before the car they
 * describe.
 *
 * The point is that a VIN identification is *checkable* in a way a photo
 * identification never is — the number is on the vehicle and position 9 proves
 * the read. So the number is shown split into its three standard blocks with
 * the check displayed honestly, rather than hidden behind a car's name the user
 * has to take on faith.
 */

function Field({ k, v }: { k: string; v?: string | number | null }) {
  if (v === null || v === undefined || v === "") return null;
  return (
    <div className="rounded-xl bg-black/[0.05] p-3">
      <div className="text-[11px] uppercase tracking-wide opacity-60">{k}</div>
      <div className="mt-0.5 font-semibold">{v}</div>
    </div>
  );
}

/** The VIN in its three standard blocks: who built it, what it is, which one. */
function VinBlocks({ vin }: { vin: string }) {
  const blocks = [
    { label: "Maker", text: vin.slice(0, 3) },
    { label: "Vehicle", text: vin.slice(3, 9) },
    { label: "Serial", text: vin.slice(9) },
  ];
  return (
    // Scrolls rather than wrapping: seventeen monospace characters plus gaps
    // overflows a narrow phone, and a VIN broken across two lines is unreadable.
    <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
      {blocks.map((b) => (
        <div key={b.label} className="shrink-0">
          <div className="rounded-lg bg-black/[0.06] px-2.5 py-1.5 font-mono text-base font-bold tracking-[0.12em] sm:text-lg">
            {b.text}
          </div>
          <div className="mt-1 text-center text-[10px] uppercase tracking-wide opacity-50">
            {b.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function VinPanel({
  vin,
  facts,
  corrected,
  ambiguous,
  registrySource,
  surface,
}: {
  vin: string;
  facts: VinFacts;
  /** The original read, when a character was provably corrected. */
  corrected?: string;
  /** Equally valid repairs, when the checksum couldn't pick between them. */
  ambiguous?: string[];
  registrySource?: string;
  /** Where on the car it was read from. */
  surface?: string;
}) {
  const verified = facts.checkDigitOk;

  return (
    <section className="mt-6 rounded-3xl border border-black/10 bg-card p-6 text-card-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">VIN</h2>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
            verified ? "bg-neon-green/15 text-neon-green" : "bg-neon-red/15 text-neon-red",
          )}
        >
          {verified ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Check digit verified
            </>
          ) : (
            <>
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              {facts.checkDigitRequired ? "Check digit failed" : "No check digit"}
            </>
          )}
        </span>
      </div>

      <VinBlocks vin={vin} />

      {/* Why it says verified. Without this the badge is just a colour. */}
      <p className="mt-2 text-xs opacity-60">
        {verified
          ? "Character 9 is a checksum over the other sixteen, and it computes — this VIN was read correctly."
          : facts.checkDigitRequired
            ? "Character 9 is a checksum over the other sixteen, and it doesn't compute — at least one character is misread."
            : "Outside North America the checksum is optional, so this VIN can be perfectly valid without one."}
      </p>

      {corrected && (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-black/[0.05] p-3 text-xs">
          <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          <span>
            Read as <span className="font-mono font-semibold">{corrected}</span>, corrected to the
            one character that makes the checksum work.
          </span>
        </p>
      )}

      {ambiguous && ambiguous.length > 1 && (
        <div className="mt-2 rounded-xl border border-neon-red/30 bg-neon-red/[0.06] p-3 text-xs">
          <p className="font-semibold">More than one correction fits.</p>
          <p className="mt-1 opacity-80">
            Any of these would pass the checksum, so the photo can&apos;t settle it — type the VIN in
            to be sure.
          </p>
          <ul className="mt-1.5 space-y-0.5 font-mono">
            {ambiguous.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field k="Manufacturer" v={facts.manufacturer} />
        <Field k="Built in" v={facts.country} />
        <Field
          k="Model year"
          v={
            facts.modelYear
              ? facts.modelYearAlt
                ? `${facts.modelYear} (or ${facts.modelYearAlt})`
                : String(facts.modelYear)
              : ""
          }
        />
        <Field k="Plant code" v={facts.plantCode} />
        <Field k="Serial" v={facts.serial} />
        <Field k="Read from" v={surface} />
      </div>

      {registrySource && (
        <p className="mt-3 text-xs opacity-60">
          Make, model and year confirmed against the {registrySource} registry.
        </p>
      )}
    </section>
  );
}

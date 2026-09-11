"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ArrowDown } from "lucide-react";
import type { TermsSection } from "@/lib/terms";
import { cn } from "@/lib/utils";

/** Sub-pixel slack — a scroller rarely lands exactly on its own scrollHeight. */
const BOTTOM_SLACK_PX = 24;

export type LegalDoc = {
  /** What the document is, for the scroll region's accessible name. */
  label: string;
  intro: string;
  sections: TermsSection[];
  /** A standing disclosure repeated under every section, if the document has one. */
  sectionNote?: string;
  entity: string;
  contactEmail: string;
};

/**
 * A legal document in a pane that must be scrolled to the end before Accept
 * unlocks.
 *
 * One implementation for the Terms and the Privacy Policy. Both are gated the
 * same way and both have to behave identically, and a second copy would be a
 * second chance to get the gate wrong — the reason this was shared between
 * /terms and the gate in the first place, now that there are two documents
 * rather than two places showing one.
 */
export function LegalReader({
  doc,
  paneHeightClass = "h-[58dvh]",
  showAccept = true,
  acceptLabel,
  accept,
  onAccepted,
}: {
  doc: LegalDoc;
  paneHeightClass?: string;
  showAccept?: boolean;
  acceptLabel: string;
  /** Writes the acceptance and returns when it was given. */
  accept: () => number;
  onAccepted?: (at: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [progress, setProgress] = useState(0);

  /**
   * `reachedEnd` latches on rather than tracking position: scrolling back up to
   * re-read a clause shouldn't withdraw the ability to accept. The requirement
   * is that the whole document was reached, not that the reader is still parked
   * at the bottom.
   */
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;

    // A viewport tall enough to show everything never fires a scroll event,
    // which would leave Accept disabled forever.
    if (max <= BOTTOM_SLACK_PX) {
      setProgress(100);
      setReachedEnd(true);
      return;
    }

    setProgress(Math.min(100, Math.round((el.scrollTop / max) * 100)));
    if (el.scrollTop >= max - BOTTOM_SLACK_PX) setReachedEnd(true);
  }, []);

  // Measure once the text has laid out, and again on resize — rotating a phone
  // changes how much of the document fits.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // No reset when the document changes, because it can't: each document has its
  // own wrapper component, so moving from the Terms to the Privacy Policy swaps
  // one element type for another and React remounts this with fresh state. A
  // previous document's "reached the end" can never carry over and unlock
  // Accept on sight.

  function onAccept() {
    if (!reachedEnd) return;
    onAccepted?.(accept());
  }

  function jumpToEnd() {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }

  return (
    <>
      {/* The document scrolls in its own pane, so "reached the end" is a fact
          about the text rather than about where the page happens to be. */}
      <div className="overflow-hidden rounded-3xl border border-black/10 bg-card text-card-foreground">
        <div
          ref={scrollerRef}
          onScroll={measure}
          tabIndex={0}
          role="region"
          aria-label={doc.label}
          className={cn(
            "overflow-y-auto px-5 py-6 outline-none focus-visible:ring-2 focus-visible:ring-black/20 sm:px-7",
            paneHeightClass,
          )}
        >
          <p className="text-[13px] leading-relaxed">{doc.intro}</p>

          {doc.sections.map((section, i) => (
            <section key={section.title} className="mt-7">
              <h2 className="text-[15px] font-extrabold tracking-tight">
                {i + 1}. {section.title}
              </h2>
              {section.blocks.map((block, j) => {
                if (block.kind === "h3") {
                  return (
                    <h3 key={j} className="mt-4 text-[13px] font-bold">
                      {block.text}
                    </h3>
                  );
                }
                if (block.kind === "ul") {
                  return (
                    <ul key={j} className="mt-2 list-disc space-y-1.5 pl-5">
                      {block.items.map((item) => (
                        <li key={item} className="text-[13px] leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={j} className="mt-2 text-[13px] leading-relaxed">
                    {block.text}
                  </p>
                );
              })}

              {/* Set apart from the clause text on purpose: it's the same
                  standing disclosure under every section, not bespoke wording
                  that differs section to section. */}
              {doc.sectionNote && (
                <p className="mt-3 border-l-2 border-black/20 pl-3 text-[12px] leading-relaxed opacity-60">
                  {doc.sectionNote}
                </p>
              )}
            </section>
          ))}

          <p className="mt-8 border-t border-black/10 pt-5 text-[13px] font-semibold">
            {doc.entity}
          </p>
          <p className="mt-1 text-[13px] opacity-70">
            Questions:{" "}
            <a href={`mailto:${doc.contactEmail}`} className="underline underline-offset-2">
              {doc.contactEmail}
            </a>
          </p>
        </div>

        {/* How far through the document the reader is. */}
        <div className="h-1 w-full bg-black/[0.08]">
          <div
            className="h-full bg-black transition-[width] duration-150"
            style={{ width: `${reachedEnd ? 100 : progress}%` }}
          />
        </div>
      </div>

      {showAccept && (
        <div className="mt-5">
          <button
            type="button"
            onClick={onAccept}
            disabled={!reachedEnd}
            aria-disabled={!reachedEnd}
            className={cn(
              "press flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-bold transition",
              reachedEnd
                ? "bg-white text-black hover:opacity-90"
                : "cursor-not-allowed border border-white/15 opacity-40",
            )}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            {acceptLabel}
          </button>

          {!reachedEnd ? (
            <button
              type="button"
              onClick={jumpToEnd}
              className="press mx-auto mt-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-60 transition hover:opacity-100"
            >
              <ArrowDown className="h-3 w-3" aria-hidden />
              Scroll to the end to accept · {progress}% read
            </button>
          ) : (
            <p className="mt-3 text-center text-[11px] uppercase tracking-wide opacity-50">
              You&apos;ve reached the end. You can accept now.
            </p>
          )}
        </div>
      )}
    </>
  );
}

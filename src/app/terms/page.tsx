"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ArrowDown, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PageMasthead } from "@/components/ui/editorial";
import {
  TERMS_SECTIONS,
  TERMS_INTRO,
  TERMS_VERSION,
  TERMS_ENTITY,
  TERMS_CONTACT_EMAIL,
} from "@/lib/terms";
import { acceptTerms, getAcceptance } from "@/lib/terms-acceptance";
import { cn } from "@/lib/utils";

/** Sub-pixel slack — a scroller rarely lands exactly on its own scrollHeight. */
const BOTTOM_SLACK_PX = 24;

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function TermsPage() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [progress, setProgress] = useState(0);
  const [acceptedAt, setAcceptedAt] = useState<number | null>(null);

  /**
   * The gate. `reachedEnd` latches on rather than tracking position, so
   * scrolling back up to re-read a clause doesn't withdraw the ability to
   * accept — the requirement is that the whole document was reached, not that
   * the reader is still parked at the bottom.
   */
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;

    // A viewport tall enough to show everything can never fire a scroll event,
    // which would leave Accept permanently disabled.
    if (max <= BOTTOM_SLACK_PX) {
      setProgress(100);
      setReachedEnd(true);
      return;
    }

    setProgress(Math.min(100, Math.round((el.scrollTop / max) * 100)));
    if (el.scrollTop >= max - BOTTOM_SLACK_PX) setReachedEnd(true);
  }, []);

  // Read in a callback rather than the effect body — localStorage is the
  // external system this is syncing from, and it can't be read during the
  // server render.
  useEffect(() => {
    Promise.resolve(getAcceptance()).then((stored) => {
      if (stored) setAcceptedAt(stored.at);
    });
  }, []);

  // Measure once the text has laid out, and again if the window resizes —
  // rotating a phone changes how much of the document fits.
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

  function accept() {
    if (!reachedEnd) return;
    setAcceptedAt(acceptTerms().at);
  }

  function jumpToEnd() {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <PageMasthead
          eyebrow={`${TERMS_ENTITY} · version ${TERMS_VERSION}`}
          title="Terms of Service"
        />

        {acceptedAt && (
          <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-neon-green/30 bg-neon-green/[0.07] px-4 py-3">
            <ShieldCheck className="h-4 w-4 shrink-0 text-neon-green" strokeWidth={2} aria-hidden />
            <p className="text-[13px] font-semibold">
              You accepted these Terms on {fmtDate(acceptedAt)}.
            </p>
          </div>
        )}

        {/* Reading pane. The document scrolls inside this box rather than with
            the page, so "reached the end" is a fact about the text itself and
            not about where the page happens to be. */}
        <div className="mt-5 overflow-hidden rounded-3xl border border-black/10 bg-card text-card-foreground">
          <div
            ref={scrollerRef}
            onScroll={measure}
            tabIndex={0}
            role="region"
            aria-label="Terms of Service"
            className="h-[58dvh] overflow-y-auto px-5 py-6 outline-none focus-visible:ring-2 focus-visible:ring-black/20 sm:px-7"
          >
            <p className="text-[13px] leading-relaxed">{TERMS_INTRO}</p>

            {TERMS_SECTIONS.map((section, i) => (
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
              </section>
            ))}

            <p className="mt-8 border-t border-black/10 pt-5 text-[13px] font-semibold">
              {TERMS_ENTITY}
            </p>
            <p className="mt-1 text-[13px] opacity-70">
              Questions:{" "}
              <a
                href={`mailto:${TERMS_CONTACT_EMAIL}`}
                className="underline underline-offset-2"
              >
                {TERMS_CONTACT_EMAIL}
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

        {!acceptedAt && (
          <div className="mt-5">
            <button
              type="button"
              onClick={accept}
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
              I have read and accept these Terms
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
                You&apos;ve reached the end — you can accept now
              </p>
            )}
          </div>
        )}

        <p className="mt-8 text-center text-[11px] uppercase tracking-wide opacity-40">
          <Link href="/spot" className="hover:opacity-80">
            Back to spotting
          </Link>
        </p>
      </main>
    </>
  );
}

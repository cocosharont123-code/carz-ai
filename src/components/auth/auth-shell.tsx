import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The frame both sign-in steps sit in.
 *
 * One component rather than two similar pages, so step two cannot drift a few
 * pixels away from step one and make the handoff between them look like a page
 * load rather than a step forward.
 *
 * Full height, and the arithmetic matters: the column this renders into already
 * carries the status-bar inset above it, so a plain 100dvh here would be the
 * viewport plus the notch and would scroll by exactly that much. The nav and the
 * back button are not subtracted because neither is drawn on these screens.
 */
const FRAME_H = "min-h-[calc(100dvh-var(--safe-top))]";

export function AuthShell({
  step,
  title,
  subtitle,
  children,
  footer,
}: {
  /** Which of the two, for the indicator. */
  step: 1 | 2;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className={cn(FRAME_H, "flex w-full flex-col items-center justify-center px-5 py-8")}>
      <div className="w-full max-w-sm">
        <StepDots step={step} />

        <h1 className="display mt-6 text-center text-5xl leading-[0.95] sm:text-6xl">
          {title}
        </h1>
        <p className="mx-auto mt-4 max-w-[17rem] text-center text-[15px] leading-relaxed opacity-60">
          {subtitle}
        </p>

        {/* The glass the rest of the app uses, at the size a form needs. */}
        <div className="glass-card mt-8 rounded-card p-5">{children}</div>

        {footer && <div className="mt-5">{footer}</div>}

        {/* Consent sits in the flow rather than floating under it. The global
            notice is hidden on these screens: a line pinned to the bottom of a
            full-height sign-in page is a line nobody reads at the moment they
            are actually agreeing to something. */}
        <p className="mt-6 text-center text-[12px] leading-relaxed opacity-45">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:opacity-100">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:opacity-100">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

/**
 * Two dots and the words.
 *
 * The words are not decoration: a filled dot and a hollow one carry the position
 * in colour and shape alone, which is no use to a screen reader and not much to
 * anyone who cannot tell the two apart.
 */
function StepDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {([1, 2] as const).map((n) => (
        <span
          key={n}
          aria-hidden
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            n === step ? "w-6 bg-carz" : "w-1.5 bg-white/25",
          )}
        />
      ))}
      <span className="util-label ml-2 opacity-50">Step {step} of 2</span>
    </div>
  );
}

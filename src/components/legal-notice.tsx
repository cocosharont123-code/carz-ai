import Link from "next/link";

/**
 * The standing notice that using the app is acceptance.
 *
 * This replaces the gate that blocked the whole app until both documents had
 * been scrolled and accepted. Browsewrap rather than clickwrap: nobody is
 * stopped, and the terms bind by use.
 *
 * Worth knowing what that trades away. A gate produces a record — this device
 * accepted this version on this date — and a notice produces none, so there is
 * nothing to point at later showing a particular person was shown a particular
 * wording. Courts also enforce browsewrap far less readily than clickwrap,
 * precisely because it does not require anyone to have seen it. It is the
 * weaker of the two; it is also what was asked for.
 *
 * Rendered in the layout under every page, so it is on the screen wherever
 * someone happens to be rather than only on a page they would have to find.
 */
export function LegalNotice() {
  return (
    <p className="mx-auto w-full max-w-2xl px-5 pb-4 text-center text-[11px] leading-relaxed opacity-45">
      By using Carz AI you agree to our{" "}
      <Link href="/terms" className="underline underline-offset-2 hover:opacity-100">
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="underline underline-offset-2 hover:opacity-100">
        Privacy Policy
      </Link>
      .
    </p>
  );
}

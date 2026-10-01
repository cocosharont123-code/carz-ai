import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleSignInButton } from "@/components/google-sign-in";

/**
 * Step two: finish it.
 *
 * The email from step one is passed to Google as login_hint, so the chooser opens
 * on that account rather than on whichever one the browser was last used with.
 * That is the whole reason step one exists.
 *
 * Google is still the authority. If someone types one address here and picks a
 * different account over there, the account they picked is the account they get —
 * login_hint is a suggestion to the chooser, not a constraint on it, and treating
 * it as a claim about anybody would be trusting a query parameter.
 *
 * A server component for the same reason step one is: the frame, the headline and
 * the address are in the HTML, and only the button that talks to Google is
 * client-side.
 */

/** Relative, single-slash, no scheme: a callbackUrl is not an open redirect. */
function safeCallback(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function ContinuePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.email) ? params.email[0] : params.email;
  const email = raw?.trim() ?? "";
  const callbackUrl = safeCallback(params.callbackUrl);

  // Deep-linked or opened without the email, which leaves nothing to show and
  // nothing to hint with. Server-side, so it never paints a half-built step two
  // on the way back to step one.
  if (!email) redirect("/signin");

  const backToStepOne = `/signin?${new URLSearchParams({ email, callbackUrl })}`;

  return (
    <AuthShell
      step={2}
      title="Almost in"
      subtitle="One tap with Google and your garage is waiting."
      footer={
        // Its own back, since the app's floating one is not drawn on these
        // screens. It carries the email, so going back lands on a filled field
        // rather than an empty one.
        <Link
          href={backToStepOne}
          replace
          className="press mx-auto flex h-11 items-center justify-center gap-1 px-4 text-[13px] font-semibold opacity-60"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          Use a different email
        </Link>
      }
    >
      {/* What they typed, shown back to them. A confirmation step that does not
          state what is being confirmed only costs a tap. */}
      <p className="util-label opacity-60">Signing in as</p>
      <p className="mt-1.5 truncate text-[17px] font-semibold" title={email}>
        {email}
      </p>

      <div className="mt-5">
        <GoogleSignInButton full callbackUrl={callbackUrl} loginHint={email} />
      </div>
    </AuthShell>
  );
}

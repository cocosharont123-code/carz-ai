import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { EmailPasswordForm } from "@/components/auth/email-password-form";
import { passwordAuthConfigured } from "@/lib/password-blob";

/**
 * Step one: sign in.
 *
 * Two ways in, not one. Google is a small pill at the top; under it is an
 * address and a password, for anyone who does not want a Google account
 * involved. The Google button used to be the whole screen -- a 5:4 tile with
 * the mark stacked over the label -- which made a Google account look like the
 * only way to use the app, because it was.
 *
 * This screen used to ask for an email address, and then Google asked for the
 * same address again one screen later -- so everybody typed their email twice
 * to sign in once. The address existed only to pass to Google as login_hint,
 * which is a convenience for the account chooser and not worth a step of its
 * own. Google is the only authority on who anybody is here, so step one is now
 * the one button that asks it.
 *
 * A server component, which is the point. The first version read the query with
 * useSearchParams, and that suspends -- so what Next prerendered for this route
 * was the Suspense fallback and nothing else, and the form only existed once the
 * client bundle had arrived. On the one screen every single visitor now has to
 * pass through, first paint was an empty black page.
 *
 * searchParams as a prop needs no hook and no boundary, so the headline, the
 * frame and the button are in the HTML. Only the click is client-side.
 *
 * Reading it also makes the route dynamic, which an auth screen has to be
 * anyway: a cached sign-in page is a sign-in page serving one person's
 * callbackUrl to the next.
 */

/** Relative, single-slash, no scheme: a callbackUrl is not an open redirect. */
function safeCallback(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);

  // Read here rather than asked for over the network. The only API that knew
  // the answer is now behind the wall this page is the door to.
  const googleEnabled = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
  // Email accounts live in Blob, so that is what makes the form real.
  const emailEnabled = passwordAuthConfigured();

  /**
   * Google hands control back to step two, not to wherever they were going.
   *
   * Step two has to run before the app does, so the real destination rides
   * along in the query and step two forwards them to it. Somebody who already
   * has an account never sees step two -- it checks and redirects on the
   * server, so there is no screen to flash past.
   */
  const afterGoogle = `/signin/finish?${new URLSearchParams({ callbackUrl })}`;

  return (
    <AuthShell
      // §2: the controls are already glass, and the shell's card would be
      // glass around glass. The shell steps out of the way on this screen.
      bare
      step={1}
      title="Sign in"
      subtitle="Your garage and your place on the leaderboard follow your account."
    >
      {/* Google first, small. `full` so it is the width of the fields under it
          -- a pill that hugged its label would be a different shape from
          everything else on the screen. */}
      <GoogleSignInButton full callbackUrl={afterGoogle} disabled={!googleEnabled} />

      {googleEnabled && emailEnabled && (
        <div className="my-5 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-[var(--line-divider)]" />
          <span className="text-[12px] uppercase tracking-wide opacity-50">or</span>
          <span className="h-px flex-1 bg-[var(--line-divider)]" />
        </div>
      )}

      {/* mt-4 when there is no divider above it -- with Google unconfigured the
          pill and the first field were 2px apart. */}
      {emailEnabled && (
        <div className={googleEnabled ? undefined : "mt-4"}>
          <EmailPasswordForm callbackUrl={afterGoogle} />
        </div>
      )}

      {!googleEnabled && !emailEnabled && (
        <p role="status" className="mt-4 text-center text-[15px] leading-snug opacity-70">
          Sign-in is being set up and isn&apos;t available just yet.
        </p>
      )}
    </AuthShell>
  );
}

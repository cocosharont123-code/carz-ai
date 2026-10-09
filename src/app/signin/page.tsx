import { AuthShell } from "@/components/auth/auth-shell";
import { EmailStep } from "@/components/auth/email-step";
import { anySignInAvailable } from "@/lib/sign-in-available";

/**
 * Step one: who you are.
 *
 * A server component, which is the point. The first version read the query with
 * useSearchParams, and that suspends — so what Next prerendered for this route
 * was the Suspense fallback and nothing else, and the form only existed once the
 * client bundle had arrived. On the one screen every single visitor now has to
 * pass through, first paint was an empty black page.
 *
 * searchParams as a prop needs no hook and no boundary, so the headline, the
 * frame and the field are in the HTML. Only the typing is client-side.
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

function first(raw: string | string[] | undefined): string {
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      step={1}
      title="Sign in"
      subtitle="Your garage, your streak and your place on the leaderboard follow your account."
    >
      <EmailStep
        callbackUrl={safeCallback(params.callbackUrl)}
        initialEmail={first(params.email)}
        // Read here rather than asked for over the network. The only API that
        // knew the answer is now behind the wall this page is the door to.
        // Any provider counts: step two offers Google and an emailed link, and
        // testing for Google alone disabled Continue on a deployment where the
        // email route worked.
        authEnabled={anySignInAvailable()}
      />
    </AuthShell>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { FinishStep } from "@/components/auth/finish-step";
import { ensureProfile, needsSetup, MIN_AGE } from "@/lib/profile-blob";

/**
 * Step two: the account itself.
 *
 * It runs after Google rather than before it, because everything on it belongs
 * to an account that exists -- a username has to be checked against the ones
 * already taken, and there is nobody to check for until somebody has signed in.
 * That is also why the old step two could only ever be a confirmation screen:
 * before Google there is nothing to ask about except the address Google is
 * about to ask for itself.
 *
 * Nobody is sent here twice. The check is on the server and the forward is a
 * redirect, so a returning account goes straight through with no screen to
 * flash past.
 *
 * A server component for the same reason step one is: the frame, the headline
 * and the starting values are in the HTML, and only the typing is client-side.
 */

/** Relative, single-slash, no scheme: a callbackUrl is not an open redirect. */
function safeCallback(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function FinishPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);

  const session = await auth();
  const email = session?.user?.email;

  // Opened without a session -- deep-linked, or the sign-in never finished.
  // Server-side, so it never paints a half-built step two on the way back.
  if (!email) redirect(`/signin?${new URLSearchParams({ callbackUrl })}`);

  // The record is created on first sight whatever happens here, so the form
  // starts from a real username rather than an empty field.
  const { profile } = await ensureProfile(email);
  if (!needsSetup(profile, email)) redirect(callbackUrl);

  return (
    <AuthShell
      step={2}
      title="Your account"
      // One line at 390px. §4: every line here is a line the form has to
      // find room for under the fold.
      subtitle="Pick how you show up — all of it is editable later."
      footer={
        // An escape hatch, because none of this is load-bearing: the username
        // and the name already exist, and the app works with the ones it
        // generated. Somebody in a hurry is asked again next time they sign in
        // rather than held at a form.
        <Link
          href={callbackUrl}
          replace
          className="press mx-auto flex h-11 items-center justify-center px-4 text-[15px] font-semibold opacity-60"
        >
          Do this later
        </Link>
      }
    >
      <FinishStep
        callbackUrl={callbackUrl}
        initialUsername={profile.username}
        // Google's name if it gave one, which it almost always does, so the
        // field is usually already right.
        initialDisplayName={(session?.user?.name || profile.displayName || "").trim()}
        // Computed on the server and handed over, so the year list is identical
        // in the HTML and after hydration.
        maxBirthYear={new Date().getUTCFullYear() - MIN_AGE}
      />
    </AuthShell>
  );
}

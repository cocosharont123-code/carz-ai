import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyStep } from "@/components/auth/verify-step";

/**
 * Where the link in the mail lands.
 *
 * The token is handed straight to the client step rather than verified here,
 * because completing a sign-in means setting a session cookie and that is
 * NextAuth's signIn() running in the browser. Verification still happens on the
 * server — inside the provider's authorize() — so nothing here is trusted; this
 * page only carries the token across.
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

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      step={2}
      title="Signing you in"
      subtitle="One moment while we check your link."
    >
      <VerifyStep token={first(params.token)} callbackUrl={safeCallback(params.callbackUrl)} />
    </AuthShell>
  );
}

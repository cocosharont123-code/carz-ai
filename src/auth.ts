import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { verifyLinkToken } from "@/lib/email-link";
import { claimLink, usedStoreConfigured } from "@/lib/email-link-used";
import { emailSignInAvailable } from "@/lib/mailer";
// import Apple from "next-auth/providers/apple";
// ^ Enable Apple once you have an Apple Developer account ($99/yr) and have set
//   AUTH_APPLE_ID + AUTH_APPLE_SECRET. Then add `Apple` to the providers array.

// Only register Google once its credentials are present — otherwise NextAuth
// throws a "server configuration" error on every auth request.
const providers: NextAuthConfig["providers"] = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

/**
 * Sign in with an email address and no Google account.
 *
 * A Credentials provider, but not a password: the only credential accepted is
 * a token this server signed and mailed to the address it names, so possession
 * of the link is the proof. Credentials is the mechanism because NextAuth's own
 * Email provider needs a database adapter to hold verification tokens, and this
 * app has no database — see lib/email-link.ts.
 *
 * Registered only when a link could actually have been sent. An enabled button
 * that mails nothing is worse than one that is not offered.
 */
if (emailSignInAvailable()) {
  providers.push(
    Credentials({
      id: "email-link",
      name: "Email",
      credentials: { token: { type: "text" } },
      async authorize(raw) {
        const token = typeof raw?.token === "string" ? raw.token : "";
        const result = verifyLinkToken(token);
        if (!result.ok) return null;

        // Spend it. Without this the link keeps working for its whole lifetime,
        // which is not what the mail promises. Refuse rather than fall back to
        // allowing: a replay check that quietly stops checking is worse than
        // none, because the mail still says the link works once.
        if (usedStoreConfigured()) {
          try {
            if (!(await claimLink(result.payload.jti))) return null;
          } catch {
            return null;
          }
        }

        // No name or picture: this is the address and nothing else. The profile
        // is provisioned from it on first sight, the same as for Google.
        return { id: result.payload.email, email: result.payload.email };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" }, // no database needed
  trustHost: true,
  pages: { signIn: "/signin" },
});

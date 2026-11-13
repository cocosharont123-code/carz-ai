import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword, passwordAuthConfigured } from "@/lib/password-blob";
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
 * Email and password, for anyone who does not want a Google account involved.
 *
 * Registered only when Blob storage is configured, because that is where the
 * accounts live -- offering the form with nowhere to read from would fail at
 * the password check with no way for anyone to tell why.
 *
 * `authorize` returns the address as both id and email, which is what the rest
 * of the app is keyed by: profiles, garages, memberships and the leaderboard
 * all look up by `session.user.email`, so a password account is the same shape
 * of account as a Google one from here on.
 *
 * It returns null for a bad address, a bad password and an address with no
 * account alike. NextAuth turns null into one generic failure, which is the
 * point: anything more specific tells a stranger which addresses are
 * registered.
 */
if (passwordAuthConfigured()) {
  providers.push(
    Credentials({
      id: "password",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (raw) => {
        const email = typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
        const password = typeof raw?.password === "string" ? raw.password : "";
        if (!email || !password) return null;
        if (!(await verifyPassword(email, password))) return null;
        return { id: email, email };
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

/** Whether anybody can sign in at all, by any route. Read by the wall. */
export function signInAvailable(): boolean {
  return providers.length > 0;
}

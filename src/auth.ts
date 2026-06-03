import NextAuth, { type NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
// import Apple from "next-auth/providers/apple";
// ^ Enable Apple once you have an Apple Developer account ($99/yr) and have set
//   AUTH_APPLE_ID + AUTH_APPLE_SECRET. Then add `Apple` to the providers array.

// Only register Google once its credentials are present — otherwise NextAuth
// throws a "server configuration" error on every auth request.
const providers: NextAuthConfig["providers"] = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(Google);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" }, // no database needed
  trustHost: true,
  pages: { signIn: "/signin" },
});

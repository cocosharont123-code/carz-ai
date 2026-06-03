import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
// import Apple from "next-auth/providers/apple";
// ^ Enable Apple once you have an Apple Developer account ($99/yr) and have set
//   AUTH_APPLE_ID + AUTH_APPLE_SECRET. Then add `Apple` to the providers array.

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google, // reads AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET from env
    // Apple,
  ],
  session: { strategy: "jwt" }, // no database needed
  trustHost: true,
  pages: { signIn: "/signin" },
});

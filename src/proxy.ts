import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * The sign-in wall.
 *
 * Nothing is reachable without a session except the sign-in flow itself, the
 * auth endpoints it needs, and the two legal documents.
 *
 * The session is verified, not merely detected. The first version of this
 * checked whether a session cookie was present, which is the cheap optimistic
 * check Next's docs describe -- and it means anyone who sets a cookie of that
 * name by hand walks straight through. Wrapping in auth() decrypts and
 * validates the JWT instead, so a forged or expired token is turned away here
 * rather than only later by whichever API route it eventually reaches.
 *
 * That costs a decrypt per request, which is why the matcher below excludes
 * static assets: the wall is checked on the way to pages and API routes, not on
 * the way to every image on them.
 *
 * It is still not the only check. Every API route asks auth() who it is talking
 * to and answers its own 401, and must keep doing so -- this decides where a
 * person is sent, and the routes decide what they are given.
 */

/**
 * Open paths.
 *
 * /signin is the flow itself. /api/auth is what it posts to, and gating it
 * would be a wall with no door. /terms and /privacy stay public on purpose:
 * they are the documents the app asks people to agree to, and a privacy policy
 * you have to already have an account to read is not a published policy. App
 * Store review also fetches the privacy URL without signing in.
 */
const OPEN = ["/signin", "/api/auth", "/terms", "/privacy"];

const isOpen = (path: string) =>
  OPEN.some((p) => path === p || path.startsWith(`${p}/`));

export default auth((request) => {
  const { pathname, search } = request.nextUrl;

  /**
   * Fail open when there is nothing to sign in with.
   *
   * If the Google credentials are missing then NextAuth registers no providers,
   * the sign-in page has no button, and gating the site would make every single
   * URL redirect to a screen that cannot let anyone through. A missing
   * environment variable would take the whole site down with no way back in,
   * which is a worse failure than an ungated one.
   */
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET) {
    return NextResponse.next();
  }

  // Decrypted and validated by the auth() wrapper, not read off a cookie name.
  const signedIn = !!request.auth;

  // Signed in and still on the sign-in flow: there is nothing here to do. Sent
  // to Settings rather than home, because wanting to change the account is the
  // only reason to open sign-in while already signed in, and Settings is where
  // that now lives.
  if (signedIn && pathname.startsWith("/signin")) {
    return NextResponse.redirect(new URL("/settings", request.url));
  }

  if (signedIn || isOpen(pathname)) return NextResponse.next();

  /**
   * An API gets an answer, not a destination.
   *
   * Redirecting /api/* to /signin hands a fetch() a 307 to a page of HTML, which
   * every caller in this app then tries to parse as JSON and fails at in some
   * unrelated way. 401 is what they are all already written to expect from these
   * routes, so an expired session now looks the same from the client as it
   * always did.
   */
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Where they were going, so the flow can put them back there afterwards.
  // Relative, and rebuilt from the parsed URL rather than taken from a header,
  // so this cannot be pointed at another origin.
  const url = new URL("/signin", request.url);
  url.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(url);
});

export const config = {
  /**
   * Everything except Next's own build output and the files that have to be
   * served to an unauthenticated browser for the sign-in page to render at all:
   * the favicon, the manifest and the icons a PWA install reads.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-touch-icon.png|icon-|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};

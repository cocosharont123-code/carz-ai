import { NextResponse, type NextRequest } from "next/server";

/**
 * First-launch entry: send a brand-new visitor to /explore once, so the first
 * thing they see is what the app can do rather than a scanner they have no
 * context for.
 *
 * Why this matches /spot and not /:
 * next.config.ts redirects / to /spot, and `redirects` from next.config runs at
 * step 2 of the routing chain while Proxy runs at step 3 — so a matcher on /
 * would never be reached. /spot is where opening the app actually lands, both
 * in the browser and in the installed app (the manifest's start_url is /).
 *
 * It fires at most once per device: the redirect sets a cookie, and so does the
 * first signed-in request, so someone who signs in before ever seeing Explore
 * is never interrupted by it later.
 */

/** Single switch. Set to false to disable the first-launch redirect entirely. */
const FIRST_LAUNCH_EXPLORE = true;

const SEEN_COOKIE = "carz_seen_explore";
const SEEN_MAX_AGE = 60 * 60 * 24 * 365; // a year

// Auth.js names the session cookie differently over HTTPS, so production and
// local development each have their own. Checking only one would bounce every
// signed-in user on prod.
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

function isSignedIn(req: NextRequest): boolean {
  // Presence only — this is a routing hint, not an authorisation check, and
  // proxies are explicitly not the place to validate a session.
  return SESSION_COOKIES.some((name) => !!req.cookies.get(name)?.value);
}

/**
 * Only a real page load should be diverted.
 *
 * Verified against the running server rather than assumed: Next 16 strips the
 * `RSC` and `next-router-prefetch` headers before Proxy runs, so neither can be
 * tested for here. What does survive is the Accept header, and it separates the
 * cases cleanly — a browser navigating to a page asks for text/html, while
 * every prefetch and client-side navigation the router makes asks for
 * text/x-component or the wildcard.
 *
 * That also settles a question the header check couldn't: tapping "Spot" in the
 * nav is a client-side navigation, so it goes where it says it goes. The
 * redirect fires when the app is opened, and never mid-session.
 */
function isPageLoad(req: NextRequest): boolean {
  return (req.headers.get("accept") ?? "").includes("text/html");
}

/**
 * Belt and braces on top of the Accept check, for the one prefetch that does
 * ask for text/html: a speculative browser prefetch, which announces itself in
 * these headers. Without this it would burn the one-time redirect on a request
 * nobody made.
 *
 * The router's own `_rsc` query parameter is not checked, because it cannot be:
 * Next strips it from both `nextUrl` and `req.url` before Proxy runs. Those
 * requests are excluded by the Accept check instead.
 */
function isPrefetch(req: NextRequest): boolean {
  return (
    (req.headers.get("sec-purpose") ?? "").includes("prefetch") ||
    (req.headers.get("purpose") ?? "") === "prefetch"
  );
}

function markSeen(res: NextResponse): NextResponse {
  res.cookies.set(SEEN_COOKIE, "1", {
    maxAge: SEEN_MAX_AGE,
    path: "/",
    sameSite: "lax",
    // Readable by the client on purpose: it records that a screen was shown,
    // not anything worth protecting.
    httpOnly: false,
  });
  return res;
}

export function proxy(req: NextRequest) {
  if (!FIRST_LAUNCH_EXPLORE) return NextResponse.next();
  if (req.method !== "GET") return NextResponse.next();
  if (!isPageLoad(req) || isPrefetch(req)) return NextResponse.next();
  if (req.cookies.get(SEEN_COOKIE)?.value) return NextResponse.next();

  // Someone with an account is not a brand-new user. Record that so signing out
  // later can't put them through a first-launch screen.
  if (isSignedIn(req)) return markSeen(NextResponse.next());

  const url = req.nextUrl.clone();
  url.pathname = "/explore";
  // Nothing on /spot is addressed by a query string today, but carrying it
  // through costs nothing and means a future deep link survives the detour.
  return markSeen(NextResponse.redirect(url));
}

export const config = {
  // Exactly one path. /api/*, /api/auth/*, /_next/* and every static asset are
  // outside this matcher and are never seen by the proxy at all.
  matcher: ["/spot"],
};

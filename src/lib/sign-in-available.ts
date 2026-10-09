import { emailSignInAvailable } from "./mailer";

/**
 * Whether anyone can sign in at all, and by which route.
 *
 * One place, because three different files were each deciding it for
 * themselves off AUTH_GOOGLE_ID — the wall, the sign-in page's Continue button,
 * and the provider list. That was correct while Google was the only way in. It
 * stopped being correct the moment a link mailed to an address could sign
 * somebody in without a Google account anywhere: the wall read "no Google, so
 * nobody can get in, so let everybody through" and took itself down on a
 * deployment where email sign-in was working fine.
 */

export function googleSignInAvailable(): boolean {
  return !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
}

export { emailSignInAvailable };

/**
 * Is there any door in the wall?
 *
 * The wall stands down only when this is false, because a gated site with no
 * working provider is every URL redirecting to a screen that cannot let anyone
 * through — including whoever would fix it.
 */
export function anySignInAvailable(): boolean {
  return googleSignInAvailable() || emailSignInAvailable();
}

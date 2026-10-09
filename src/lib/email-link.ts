import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Sign-in links that carry their own proof.
 *
 * NextAuth's own Email provider wants a database adapter to hold verification
 * tokens, and this app has no database — storage is Blob and the session is a
 * JWT. So the token is the record: an HMAC over the address and an expiry,
 * signed with AUTH_SECRET. Nothing is written when the link is issued, and
 * verifying it is a hash rather than a lookup.
 *
 * What that buys and what it costs: no schema, no adapter, no round trip — but
 * a signature alone cannot know it has already been spent. Single use is
 * enforced separately in email-link-used.ts, and the window is kept short so a
 * link that leaks is a narrow problem rather than a standing one.
 */

/** Long enough to walk to another device and find the mail, short enough to matter. */
export const LINK_TTL_MS = 15 * 60 * 1000;

export type LinkPayload = {
  /** The address the link was sent to. The only identity claim it makes. */
  email: string;
  /** Expiry, epoch ms. */
  exp: number;
  /** Random per link, so two links for the same address are distinguishable. */
  jti: string;
};

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/**
 * Namespaced so a signature minted here can never be mistaken for one of
 * NextAuth's own tokens, which are signed with the same secret.
 */
function sign(body: string): string {
  return b64url(createHmac("sha256", secret()).update(`carz.email-link.v1.${body}`).digest());
}

export function createLinkToken(email: string, now = Date.now()): string {
  const payload: LinkPayload = {
    email: email.trim().toLowerCase(),
    exp: now + LINK_TTL_MS,
    jti: randomBytes(12).toString("base64url"),
  };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export type VerifyResult =
  | { ok: true; payload: LinkPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyLinkToken(token: string, now = Date.now()): VerifyResult {
  const parts = typeof token === "string" ? token.split(".") : [];
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [body, given] = parts;

  // Constant-time, and length-checked first because timingSafeEqual throws on a
  // length mismatch rather than returning false.
  const expected = Buffer.from(sign(body));
  const supplied = Buffer.from(given);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: LinkPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!payload?.email || typeof payload.exp !== "number" || !payload.jti) {
    return { ok: false, reason: "malformed" };
  }
  // Checked after the signature on purpose: an expiry read out of an unverified
  // body is just an attacker's number.
  if (now > payload.exp) return { ok: false, reason: "expired" };

  return { ok: true, payload };
}

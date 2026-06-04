import crypto from "crypto";

// Proof that a car was actually identified by our API — required to post to the
// feed, so you can only post cars you've identified (not arbitrary photos).
const SECRET = process.env.AUTH_SECRET || "dev-secret";
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export function signPostToken(make: string, model: string): string {
  const payload = `${make}|${model}|${Date.now() + TTL_MS}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return Buffer.from(payload).toString("base64url") + "." + sig;
}

export function verifyPostToken(token: string, make: string, model: string): boolean {
  try {
    const [b64, sig] = (token || "").split(".");
    if (!b64 || !sig) return false;
    const payload = Buffer.from(b64, "base64url").toString();
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const [m, mo, expStr] = payload.split("|");
    if (Number(expStr) < Date.now()) return false;
    return m === make && mo === model;
  } catch {
    return false;
  }
}

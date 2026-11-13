import { put, list } from "@vercel/blob";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { blobToken, blobConfigured } from "./blob-token";

/**
 * Email-and-password accounts.
 *
 * Google was the only way in, which made a Google account a requirement for
 * using the app. This is the other way: an address and a password, stored in
 * Blob like everything else here, since there is no database.
 *
 * What is stored, and what is not:
 *
 *  - The address is never written in the clear. Each account is one object
 *    named by the SHA-256 of the lowercased address, so neither the pathname
 *    nor the body names anybody. The address does go in the session once
 *    someone signs in -- the whole app is keyed by it -- but it is not sitting
 *    in storage.
 *  - The password is never stored in any form that can be reversed. What is
 *    kept is scrypt(password, salt) with a fresh 16-byte salt per account.
 *    scrypt is deliberately slow and memory-hard, which is the property that
 *    matters if the store is ever read by someone who should not have it.
 *  - Comparison is timingSafeEqual, not ===. A comparison that returns early
 *    leaks where the first difference is, one request at a time.
 *
 * The cost parameters are recorded on each record rather than assumed, so they
 * can be raised later without locking out every account created before the
 * change: verification uses the parameters the record was written with.
 *
 * ---
 *
 * One object per account, rather than one document holding them all, and that
 * is not a style choice -- the single document did not work. Vercel Blob serves
 * public URLs through a CDN with a 60-second floor on max-age (it rejects
 * anything lower), and it ignores the query string, so the `?t=${Date.now()}`
 * trick used elsewhere in this app does not bust it: measured on a real write,
 * the read that followed came back `x-vercel-cache: HIT` with the previous
 * body and `age: 90`. Signing up therefore wrote the account and the sign-in
 * one second later read a document that did not contain it yet.
 *
 * A fresh account is a pathname that has never been fetched, so there is
 * nothing cached under it and the first read is the truth. Existence checks go
 * through list(), which is the API rather than the CDN and is consistent.
 *
 * The remaining window is a password that *changes*: for up to a minute after
 * a rewrite, a read of that one path can still serve the old record. There is
 * no password-change feature yet; whoever adds one has to deal with that, and
 * writing the new record under a new name is the way out.
 */

const DIR = "auth/pw";
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/** Current cost. N is the work factor; r and p are the standard pairings. */
const COST = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 64;
// scrypt's default maxmem (32MB) is under what N=16384, r=8 needs on some
// builds, and the failure is a thrown error rather than a slow hash.
const MAXMEM = 64 * 1024 * 1024;

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;

type Credential = {
  salt: string; // hex
  hash: string; // hex
  N: number;
  r: number;
  p: number;
  createdAt: number;
};

export function passwordAuthConfigured(): boolean {
  return blobConfigured();
}

function pathFor(email: string): string {
  const id = createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
  return `${DIR}/${id}.json`;
}

/** The blob's URL, straight from the API. Null when no account exists. */
async function urlFor(email: string): Promise<string | null> {
  if (!blobConfigured()) return null;
  const path = pathFor(email);
  try {
    const { blobs } = await list({ prefix: path, token: blobToken() });
    return blobs.find((b) => b.pathname === path)?.url ?? null;
  } catch {
    return null;
  }
}

/** Whether an account already exists for this address. */
export async function hasPassword(email: string): Promise<boolean> {
  return !!(await urlFor(email));
}

export type CreateResult = { ok: true } | { ok: false; error: "exists" | "weak" | "storage" };

/** Create an account. Refuses an address that already has one. */
export async function createPassword(email: string, password: string): Promise<CreateResult> {
  if (!blobConfigured()) return { ok: false, error: "storage" };
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return { ok: false, error: "weak" };
  }
  if (await hasPassword(email)) return { ok: false, error: "exists" };

  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEYLEN, { ...COST, maxmem: MAXMEM });
  const record: Credential = {
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
    ...COST,
    createdAt: Date.now(),
  };
  try {
    await put(pathFor(email), JSON.stringify(record), {
      access: "public",
      contentType: "application/json",
      // Not an overwrite: an existing path means an account already exists, and
      // the check above can lose a race with a second request in the same
      // instant. Letting the write fail is how that race ends safely -- the
      // alternative is one of the two sign-ups silently replacing the other's
      // password.
      allowOverwrite: false,
      addRandomSuffix: false,
      cacheControlMaxAge: 60, // the floor; see the note at the top
      token: blobToken(),
    });
    return { ok: true };
  } catch {
    // Either storage is down or the path appeared between the check and the
    // write. "exists" is the safer of the two to report: it tells someone with
    // an account to sign in, and tells an attacker nothing it did not already
    // know from the check above.
    return (await hasPassword(email))
      ? { ok: false, error: "exists" }
      : { ok: false, error: "storage" };
  }
}

/**
 * Check an address and password.
 *
 * False for an address with no account, so nothing here distinguishes "no such
 * account" from "wrong password" -- that difference is an oracle for which
 * addresses are registered.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!blobConfigured() || !password) return false;
  const url = await urlFor(email);
  if (!url) return false;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const record = (await res.json()) as Partial<Credential>;
    if (typeof record?.salt !== "string" || typeof record?.hash !== "string") return false;
    const expected = Buffer.from(record.hash, "hex");
    const actual = await scryptAsync(password, Buffer.from(record.salt, "hex"), KEYLEN, {
      N: typeof record.N === "number" ? record.N : COST.N,
      r: typeof record.r === "number" ? record.r : COST.r,
      p: typeof record.p === "number" ? record.p : COST.p,
      maxmem: MAXMEM,
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

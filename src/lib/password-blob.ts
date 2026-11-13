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
 *  - The address is never written in the clear. The record is keyed by the
 *    same SHA-256 of the lowercased address that profile-blob uses, so the two
 *    stores line up and the blob itself names nobody. The address does go in
 *    the session once someone signs in -- the whole app is keyed by it -- but
 *    it is not sitting in public storage.
 *  - The password is never stored, in any form that can be reversed. What is
 *    kept is scrypt(password, salt) with a fresh 16-byte salt per account.
 *    scrypt is deliberately slow and memory-hard, which is the property that
 *    matters if the blob is ever read by someone who should not have it.
 *  - Comparison is timingSafeEqual, not ===. A byte-by-byte comparison that
 *    returns early leaks where the first difference is, one request at a time.
 *
 * The cost parameters are recorded on each record rather than assumed, so they
 * can be raised later without locking out every account created before the
 * change: verification uses the parameters the record was written with.
 */

const PATH = "auth/passwords.json";
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

type Record = {
  /** sha256 of the lowercased, trimmed address. Never the address itself. */
  id: string;
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

export function emailId(email: string): string {
  return createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

async function currentUrl(): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: PATH, token: blobToken() });
    const hit = blobs.find((b) => b.pathname === PATH) ?? blobs[0];
    return hit?.url ?? null;
  } catch {
    return null;
  }
}

async function readAll(): Promise<Record[]> {
  if (!blobConfigured()) return [];
  const url = await currentUrl();
  if (!url) return [];
  try {
    // Cache-busted: a stale CDN copy here is an account that cannot sign in
    // seconds after creating itself.
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as Record[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(records: Record[]): Promise<void> {
  await put(PATH, JSON.stringify(records), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    // Short, because a sign-in immediately after sign-up reads this back.
    cacheControlMaxAge: 0,
    token: blobToken(),
  });
}

async function derive(password: string, salt: Buffer, cost: { N: number; r: number; p: number }) {
  return scryptAsync(password, salt, KEYLEN, { ...cost, maxmem: MAXMEM });
}

/** Whether an account already exists for this address. */
export async function hasPassword(email: string): Promise<boolean> {
  const id = emailId(email);
  return (await readAll()).some((r) => r.id === id);
}

export type CreateResult =
  | { ok: true }
  | { ok: false; error: "exists" | "weak" | "storage" };

/**
 * Create an account. Refuses an address that already has one.
 *
 * Read-modify-write on one document, which is what every store in this app
 * does. Two sign-ups landing in the same instant could in principle lose one;
 * the trade is a schema with no database behind it, and the loser sees
 * "couldn't create that account" rather than a half-made one.
 */
export async function createPassword(email: string, password: string): Promise<CreateResult> {
  if (!blobConfigured()) return { ok: false, error: "storage" };
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return { ok: false, error: "weak" };
  }
  const id = emailId(email);
  const records = await readAll();
  if (records.some((r) => r.id === id)) return { ok: false, error: "exists" };

  const salt = randomBytes(16);
  const hash = await derive(password, salt, COST);
  records.push({
    id,
    salt: salt.toString("hex"),
    hash: hash.toString("hex"),
    ...COST,
    createdAt: Date.now(),
  });
  try {
    await writeAll(records);
    return { ok: true };
  } catch {
    return { ok: false, error: "storage" };
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
  const id = emailId(email);
  const record = (await readAll()).find((r) => r.id === id);
  if (!record) return false;
  try {
    const expected = Buffer.from(record.hash, "hex");
    const actual = await derive(password, Buffer.from(record.salt, "hex"), {
      N: record.N,
      r: record.r,
      p: record.p,
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

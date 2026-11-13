import { NextResponse } from "next/server";
import {
  createPassword,
  passwordAuthConfigured,
  MIN_PASSWORD,
  MAX_PASSWORD,
} from "@/lib/password-blob";

export const runtime = "nodejs";

/**
 * Create an email-and-password account.
 *
 * Open by design -- it is the door, and the wall in proxy.ts lets /api/auth
 * through for exactly that reason. What it will not do is tell a stranger
 * anything about who already has an account: an address that is taken gets the
 * same 409 whether or not it is real, and nothing here confirms an address
 * exists before a password is set on it.
 *
 * The password itself never leaves this request: createPassword derives a
 * scrypt hash and stores that.
 */

/** Deliberately loose -- the authority on whether an address exists is the inbox. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * A per-instance throttle.
 *
 * Serverless gives no shared counter, so this slows a burst from one address
 * rather than stopping a distributed one -- it is a speed bump, not a defence,
 * and it is honest about that. The real cost to an attacker is scrypt: every
 * attempt, here or at sign-in, costs the server 16384 rounds and them a
 * round trip.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const seen = new Map<string, number[]>();

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (seen.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(key, hits);
  // The map is per-instance and instances are short-lived, but a long-lived one
  // should not grow without bound.
  if (seen.size > 500) {
    for (const [k, v] of seen) if (v.every((t) => now - t >= WINDOW_MS)) seen.delete(k);
  }
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  if (!passwordAuthConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Email sign-up isn't configured on this server yet." },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!LOOKS_LIKE_EMAIL.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: `Use at least ${MIN_PASSWORD} characters.` },
      { status: 400 },
    );
  }
  if (password.length > MAX_PASSWORD) {
    return NextResponse.json({ ok: false, error: "That password is too long." }, { status: 400 });
  }
  // A password that is the address is the first thing anyone tries.
  if (password.toLowerCase() === email || password.toLowerCase() === email.split("@")[0]) {
    return NextResponse.json(
      { ok: false, error: "Don't use your email address as your password." },
      { status: 400 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (throttled(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const result = await createPassword(email, password);
  if (!result.ok) {
    if (result.error === "exists") {
      return NextResponse.json(
        { ok: false, error: "That email already has an account. Sign in instead." },
        { status: 409 },
      );
    }
    if (result.error === "weak") {
      return NextResponse.json(
        { ok: false, error: `Use at least ${MIN_PASSWORD} characters.` },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Couldn't create that account. Try again." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}

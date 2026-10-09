import { NextResponse } from "next/server";
import { createLinkToken } from "@/lib/email-link";
import { takeLinkRequest } from "@/lib/email-link-used";
import { emailSignInAvailable, sendSignInLink } from "@/lib/mailer";

export const runtime = "nodejs";

/** Deliberately loose — the authority on whether an address exists is the inbox. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Relative, single-slash, no scheme: a callbackUrl is not an open redirect. */
function safeCallback(raw: unknown): string {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export async function POST(req: Request) {
  if (!emailSignInAvailable()) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  let body: { email?: string; callbackUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!LOOKS_LIKE_EMAIL.test(email)) {
    return NextResponse.json({ ok: false, error: "bad_email" }, { status: 400 });
  }

  const allowed = await takeLinkRequest(email);

  // Answered the same either way, and the same whether or not the address has
  // ever been seen before. A sign-in form that says "too many requests" for one
  // address and "sent" for another is a way to ask which addresses have
  // accounts, and to confirm a guess about somebody.
  if (allowed) {
    const token = createLinkToken(email);
    const origin = new URL(req.url).origin;
    const url = `${origin}/signin/verify?${new URLSearchParams({
      token,
      callbackUrl: safeCallback(body.callbackUrl),
    })}`;
    const sent = await sendSignInLink(email, url);
    if (!sent.ok && sent.error === "not_configured") {
      return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
    }
    // A send failure is logged server-side and still reads as sent here, for
    // the same reason: the caller learns nothing about the address either way.
  }

  return NextResponse.json({ ok: true });
}

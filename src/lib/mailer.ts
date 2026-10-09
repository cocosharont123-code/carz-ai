/**
 * Sending one kind of mail: the sign-in link.
 *
 * Over Resend's REST API with fetch rather than its SDK — one POST with a JSON
 * body does not justify a dependency, and this codebase already reaches Blob
 * and the model APIs the same way.
 *
 * With no key configured the link is written to the server log instead of sent.
 * That is deliberate for local work, where provisioning a mail provider to test
 * a sign-in screen is the thing that stops the screen being tested, and it is
 * refused outright in production below — a sign-in link in a log is a sign-in
 * link for whoever reads logs.
 */

const ENDPOINT = "https://api.resend.com/emails";

/** Resend's shared sender, usable with no domain set up. Override once you have one. */
const DEFAULT_FROM = "Carz AI <onboarding@resend.dev>";

export function mailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY?.trim();
}

/**
 * Whether email sign-in can be offered at all.
 *
 * In development an unconfigured mailer still works — the link goes to the
 * console — so the option stays available. In production it does not.
 */
export function emailSignInAvailable(): boolean {
  return mailConfigured() || process.env.NODE_ENV !== "production";
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendSignInLink(to: string, url: string): Promise<SendResult> {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, error: "not_configured" };
    }
    console.info(`\n  Sign-in link for ${to}:\n  ${url}\n`);
    return { ok: true };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [to],
        subject: "Your Carz AI sign-in link",
        text: textBody(url),
        html: htmlBody(url),
      }),
    });
    if (!res.ok) {
      // The body carries Resend's reason — an unverified domain, a bad key.
      // Logged for the operator, never returned to the caller.
      console.error("Resend rejected the sign-in mail:", res.status, await res.text().catch(() => ""));
      return { ok: false, error: "send_failed" };
    }
    return { ok: true };
  } catch (e) {
    console.error("Could not reach Resend:", e);
    return { ok: false, error: "send_failed" };
  }
}

function textBody(url: string): string {
  return [
    "Tap the link below to sign in to Carz AI.",
    "",
    url,
    "",
    "The link works once and expires in 15 minutes.",
    "If you didn't ask to sign in, you can ignore this — nobody can get in without this link.",
  ].join("\n");
}

/**
 * Deliberately plain. Mail clients are not browsers: a table-based layout with
 * inline styles renders the same in Outlook as in Mail, and a sign-in mail that
 * arrives looking broken reads as a phishing attempt.
 */
function htmlBody(url: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <tr><td>
      <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3">Sign in to Carz AI</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#555">
        Tap the button to finish signing in. The link works once and expires in 15 minutes.
      </p>
      <a href="${url}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:999px">
        Sign in
      </a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#777">
        Or paste this into your browser:<br>
        <span style="word-break:break-all;color:#555">${url}</span>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#777">
        If you didn't ask to sign in, you can ignore this. Nobody can get in without the link.
      </p>
    </td></tr>
  </table>
</body></html>`;
}

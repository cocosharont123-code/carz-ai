"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sign in, or sign up, with an address and a password.
 *
 * Sits under the Google button for everyone who does not want a Google account
 * involved. One form for both jobs, with a toggle: the fields are identical,
 * and two screens for the same two inputs is a decision nobody wants to make
 * before they have typed anything.
 *
 * Creating an account is two requests on purpose. /api/auth/register writes the
 * credential and answers; then the same credential goes through NextAuth's
 * normal sign-in, so a new account lands in the session by exactly the same
 * path an existing one does and there is no second way in to keep correct.
 *
 * Both paths end at `callbackUrl`, which the page points at step two -- so a
 * password account is asked for a username like any other.
 */
export function EmailPasswordForm({
  callbackUrl,
  disabled,
}: {
  callbackUrl: string;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signingUp = mode === "up";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || disabled) return;
    setError("");
    const address = email.trim().toLowerCase();
    if (!address || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (signingUp) {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: address, password }),
        });
        const d = await res.json().catch(() => null);
        if (!res.ok || !d?.ok) {
          setError(d?.error || "Couldn't create that account.");
          setBusy(false);
          return;
        }
      }

      // redirect:false so a wrong password lands back here with a message
      // rather than on NextAuth's own error page.
      const result = await signIn("password", { email: address, password, redirect: false });
      if (result?.error) {
        setError(
          signingUp
            ? "Account created, but signing in failed. Try signing in."
            : "That email and password don't match.",
        );
        setBusy(false);
        return;
      }
      // A full navigation, not router.push: the session cookie was just set and
      // every screen past the wall is rendered on the server from it.
      window.location.assign(callbackUrl);
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  const field =
    "h-[52px] w-full rounded-full glass-card px-4 text-[16px] text-foreground outline-none placeholder:text-[var(--color-muted-text)]";

  return (
    <form onSubmit={submit} className="w-full">
      <label className="sr-only" htmlFor="auth-email">
        Email
      </label>
      <input
        id="auth-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        disabled={disabled}
        className={field}
      />

      <label className="sr-only" htmlFor="auth-password">
        Password
      </label>
      <div className="relative mt-2.5">
        <input
          id="auth-password"
          type={show ? "text" : "password"}
          // The browser offers to save a new password on one and fill the
          // saved one on the other; the wrong hint here is a password manager
          // quietly doing the wrong thing.
          autoComplete={signingUp ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={signingUp ? "Password (8 characters or more)" : "Password"}
          disabled={disabled}
          className={cn(field, "pr-12")}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="press absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-muted-text)]"
        >
          {show ? (
            <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          ) : (
            <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>

      <button
        type="submit"
        disabled={busy || disabled}
        aria-busy={busy || undefined}
        className="press mt-2.5 h-[52px] w-full rounded-full bg-carz text-[15px] font-semibold text-carz-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy
          ? signingUp
            ? "Creating account…"
            : "Signing in…"
          : signingUp
            ? "Create account"
            : "Sign in"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-center text-[14px] text-error">
          {error}
        </p>
      )}

      <p className="mt-4 text-center text-[14px] opacity-70">
        {signingUp ? "Already have an account?" : "No account yet?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(signingUp ? "in" : "up");
            setError("");
          }}
          className="font-semibold text-foreground underline underline-offset-2"
        >
          {signingUp ? "Sign in" : "Sign up with email"}
        </button>
      </p>
    </form>
  );
}

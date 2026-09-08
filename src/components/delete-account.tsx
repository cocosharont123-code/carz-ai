"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { TriangleAlert } from "lucide-react";
import { Spinner } from "@/components/ui/editorial";

/**
 * Deleting the account, with the confirm step that has to come first.
 *
 * Lives here rather than inside a page because two screens offer it now —
 * Settings and Account — and a destructive action implemented twice is a
 * destructive action that can behave two different ways.
 */
export function DeleteAccount() {
  // Three states rather than two: the confirm panel is the "are you sure" step,
  // and it has to be impossible to reach the destructive call without passing
  // through it. `deleting` locks both buttons so a double-click can't re-fire.
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function reallyDelete() {
    setError("");
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Couldn't delete your account.");
        setDeleting(false);
        return;
      }
      // The record is gone; the session is the last thing pointing at it.
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Network error — your account was not deleted.");
      setDeleting(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-neon-red/30 bg-neon-red/[0.04] p-5">
      <div className="flex items-center gap-2">
        <TriangleAlert className="h-4 w-4 text-neon-red" strokeWidth={2} aria-hidden />
        <h2 className="text-sm font-bold uppercase tracking-wide text-neon-red">Danger zone</h2>
      </div>

      {!confirming ? (
        <>
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed opacity-70">
            Permanently erase your account — username, picture, Carz+ membership, day streak,
            spotting history and scan counts.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="press mt-4 rounded-full bg-neon-red px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110"
          >
            Delete account
          </button>
        </>
      ) : (
        <div className="mt-3 rounded-xl border border-neon-red/50 bg-black/40 p-4">
          <p className="text-sm font-bold">Are you sure you want to delete your account?</p>
          <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed opacity-75">
            This cannot be undone. Your username is released for anyone else to take, and any
            Carz+ membership is lost immediately without a refund.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-neon-red/50 bg-neon-red/10 p-2.5 text-[13px] text-neon-red"
            >
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={reallyDelete}
              disabled={deleting}
              aria-busy={deleting || undefined}
              className="press inline-flex items-center gap-2 rounded-full bg-neon-red px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting && <Spinner className="h-3.5 w-3.5" />}
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setError("");
              }}
              disabled={deleting}
              className="press rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold transition hover:border-white/40 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

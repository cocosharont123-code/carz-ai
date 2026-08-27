"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { Gauge, Crosshair, Lock, TriangleAlert } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button, PageMasthead, Skeleton, Spinner } from "@/components/ui/editorial";
import { cn } from "@/lib/utils";
import type { ScanMode } from "@/lib/scan-mode";

type Settings = {
  member: boolean;
  scanMode: ScanMode;
  effectiveScanMode: ScanMode;
};

const MODES: {
  id: ScanMode;
  name: string;
  tagline: string;
  detail: string;
  premium: boolean;
  Icon: typeof Gauge;
}[] = [
  {
    id: "fast",
    name: "Fast",
    tagline: "Super fast · a little less accurate",
    detail:
      "One look at the photo and an answer straight back. Right on almost every car you'll point it at; the ones it can miss are near-identical trims and lookalike generations.",
    premium: false,
    Icon: Gauge,
  },
  {
    id: "precise",
    name: "Precise",
    tagline: "A little slower · near-perfect accuracy",
    detail:
      "Runs a second independent look, magnifies the one detail that decides it — a badge, a taillight's internals — and brings in a third opinion to settle any disagreement. This is what catches the cars Fast gets wrong.",
    premium: true,
    Icon: Crosshair,
  },
];

function ScanModeCard({
  mode,
  selected,
  locked,
  busy,
  onPick,
}: {
  mode: (typeof MODES)[number];
  selected: boolean;
  locked: boolean;
  busy: boolean;
  onPick: () => void;
}) {
  const { Icon } = mode;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      aria-pressed={selected}
      className={cn(
        "press relative w-full rounded-2xl border p-5 text-left transition disabled:cursor-not-allowed",
        selected
          ? "border-neon-blue/70 bg-neon-blue/[0.07] shadow-[0_0_28px_-14px_rgba(0,229,255,0.9)]"
          : "border-white/10 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.05]",
        locked && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-neon-blue" : "opacity-60")}
          strokeWidth={1.75}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold">{mode.name}</span>
            {mode.premium && (
              <span className="rounded-full bg-carz/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-carz">
                Carz+
              </span>
            )}
            {locked && <Lock className="h-3.5 w-3.5 opacity-60" aria-hidden />}
            {selected && (
              <span className="ml-auto text-[11px] font-bold uppercase tracking-wide text-neon-blue">
                Active
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] font-medium opacity-80">{mode.tagline}</p>
          <p className="mt-2 text-[13px] leading-relaxed opacity-60">{mode.detail}</p>
        </div>
      </div>
    </button>
  );
}

function DeleteAccount() {
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

export default function SettingsPage() {
  const { status: authStatus } = useSession();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ScanMode | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: Settings) => setSettings(d))
      .catch(() => setError("Couldn't load your settings."))
      .finally(() => setLoading(false));
  }, [authStatus]);

  async function pick(mode: ScanMode) {
    if (!settings || settings.scanMode === mode) return;
    setError("");
    setSaving(mode);
    // Optimistic: the choice is a cookie write that either lands or doesn't,
    // and rolling back on failure is cheaper than a spinner on every card.
    const previous = settings;
    setSettings({ ...settings, scanMode: mode, effectiveScanMode: mode });
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanMode: mode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSettings(previous);
        setError(data.error || "Couldn't save that.");
      }
    } catch {
      setSettings(previous);
      setError("Network error — your setting wasn't saved.");
    } finally {
      setSaving(null);
    }
  }

  const signedIn = authStatus === "authenticated";
  const member = settings?.member ?? false;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-5 py-14">
        <PageMasthead title="Settings" eyebrow="Your account" />

        {/* --- Identification --- */}
        <section className="mt-8">
          <h2 className="text-xl font-bold">Identification</h2>
          <p className="mt-1 text-[13px] opacity-60">
            How hard a scan works before it answers.
          </p>

          {loading ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {MODES.map((m) => {
                const locked = m.premium && !member;
                return locked ? (
                  <div key={m.id}>
                    <ScanModeCard
                      mode={m}
                      selected={false}
                      locked
                      busy={saving !== null}
                      onPick={() => {}}
                    />
                    <Link
                      href="/pricing"
                      className="mt-2 flex items-center justify-between rounded-xl border border-carz/30 bg-carz/[0.06] px-4 py-2.5 text-[13px] font-semibold transition hover:border-carz/60 hover:bg-carz/[0.1]"
                    >
                      <span>Get Carz+ to unlock Precise scanning</span>
                      <span className="text-carz">$9.99/mo →</span>
                    </Link>
                  </div>
                ) : (
                  <ScanModeCard
                    key={m.id}
                    mode={m}
                    selected={settings?.scanMode === m.id}
                    locked={false}
                    busy={saving !== null}
                    onPick={() => pick(m.id)}
                  />
                );
              })}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-neon-red/50 bg-neon-red/10 p-3 text-sm text-neon-red"
            >
              {error}
            </div>
          )}
        </section>

        {/* --- Account --- */}
        <section className="mt-10">
          <h2 className="text-xl font-bold">Account</h2>
          {signedIn ? (
            <div className="mt-3 space-y-2">
              <Link
                href="/profile"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold transition hover:border-white/25 hover:bg-white/[0.05]"
              >
                <span>Edit profile</span>
                <span className="opacity-50">Username, display name, picture →</span>
              </Link>
              <Link
                href="/membership"
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold transition hover:border-white/25 hover:bg-white/[0.05]"
              >
                <span>Membership</span>
                <span className="opacity-50">{member ? "Carz+ active →" : "Not a member →"}</span>
              </Link>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="press flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm font-semibold transition hover:border-white/25 hover:bg-white/[0.05]"
              >
                <span>Sign out</span>
                <span className="opacity-50">→</span>
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <p className="text-sm opacity-75">
                Sign in to manage your profile, membership and account.
              </p>
              <Button onClick={() => signIn("google", { callbackUrl: "/settings" })} className="mt-4">
                Sign in
              </Button>
            </div>
          )}
        </section>

        {/* --- Legal --- */}
        <section className="mt-10">
          <h2 className="text-xl font-bold">Legal</h2>
          <div className="mt-3">
            <Link
              href="/terms"
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold transition hover:border-white/25 hover:bg-white/[0.05]"
            >
              <span>Terms of Service</span>
              <span className="opacity-50">Read and accept →</span>
            </Link>
          </div>
        </section>

        {/* Deleting is only meaningful for an account that exists. */}
        {signedIn && <DeleteAccount />}
      </main>
    </>
  );
}

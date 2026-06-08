"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { SiteHeader } from "@/components/site-header";

function ProfileInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/feed";
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured !== false);
        setSignedIn(!!d.signedIn);
        if (d.profile) {
          setUsername(d.profile.username || "");
          setDisplayName(d.profile.displayName || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.toLowerCase(), displayName }),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg("Saved! 🎉");
        setTimeout(() => router.push(next), 700);
      } else {
        setMsg(d.error || "Couldn't save.");
      }
    } catch {
      setMsg("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">Your profile</h1>
      <p className="mt-1 text-muted-foreground">Pick a username and display name for the feed.</p>

      {loading ? (
        <div className="mt-8 h-40 animate-pulse rounded-3xl bg-foreground/[0.04]" />
      ) : !configured ? (
        <div className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          Profiles aren&apos;t enabled yet (the database isn&apos;t connected). Check back soon.
        </div>
      ) : !signedIn ? (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">Sign in to set up your profile.</p>
          <button
            onClick={() => signIn("google", { callbackUrl: "/profile" })}
            className="mt-4 rounded-xl bg-white px-5 py-2.5 font-semibold text-[#1f1f1f]"
          >
            Continue with Google
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Username
            </label>
            <div className="mt-1 flex items-center rounded-xl border border-foreground/10 bg-background px-3">
              <span className="text-muted-foreground">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="speed_demon"
                maxLength={20}
                className="w-full bg-transparent px-1 py-2.5 text-sm outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">3–20 chars · lowercase, numbers, underscores</p>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Display name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Alex Rivera"
              maxLength={40}
              className="mt-1 w-full rounded-xl border border-foreground/10 bg-background px-3 py-2.5 text-sm outline-none"
            />
          </div>

          <button
            onClick={save}
            disabled={saving || username.length < 3}
            className="w-full rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {msg && (
            <p className={`text-center text-sm ${msg.startsWith("Saved") ? "text-emerald-300" : "text-red-300"}`}>
              {msg}
            </p>
          )}
        </div>
      )}
    </main>
  );
}

export default function ProfilePage() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<div className="flex-1" />}>
        <ProfileInner />
      </Suspense>
    </>
  );
}

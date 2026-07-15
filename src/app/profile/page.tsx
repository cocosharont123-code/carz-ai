"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { SiteHeader } from "@/components/site-header";
import { Avatar } from "@/components/default-avatar";

function downscale(dataUrl: string, max = 256, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function ProfileInner() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/spot";

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [image, setImage] = useState("");
  const [existing, setExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (authStatus !== "authenticated") return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.profile) {
          setUsername(d.profile.username || "");
          setDisplayName(d.profile.displayName || "");
          setImage(d.profile.image || "");
          setExisting(!!d.profile.username);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authStatus]);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(file);
    });
    const thumb = await downscale(raw);
    setImage(thumb);
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, image }),
      });
      const d = await res.json();
      if (!d.ok) {
        setError(d.error || "Couldn't save.");
        return;
      }
      router.replace(next);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md px-5 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {existing ? "Edit your profile" : "Create your profile"}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {existing ? "Update your username and picture." : "Pick a username to start spotting. A profile picture is optional."}
        </p>

        {loading ? (
          <div className="mt-8 h-64 animate-pulse rounded-3xl bg-foreground/[0.04]" />
        ) : authStatus === "unauthenticated" ? (
          <div className="mt-8 rounded-3xl border border-foreground/[0.06] bg-card p-8 text-center">
            <div className="text-4xl">🔑</div>
            <h3 className="mt-3 text-lg font-bold">Sign in to set up your profile</h3>
            <button
              onClick={() => signIn("google", { callbackUrl: "/profile" })}
              className="mt-4 rounded-xl bg-white px-5 py-2.5 font-semibold text-[#1f1f1f]"
            >
              Continue with Google
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* picture + preview */}
            <div className="flex items-center gap-4">
              <Avatar src={image} size={80} rounded="1.25rem" />
              <div className="space-y-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-xl border border-foreground/15 bg-foreground/[0.06] px-4 py-2 text-sm font-semibold hover:bg-foreground/[0.12]"
                >
                  {image ? "Change picture" : "Upload picture"}
                </button>
                {image && (
                  <button
                    onClick={() => setImage("")}
                    className="ml-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-muted-foreground">
                  Optional — leave empty for the animated car avatar.
                </p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            </div>

            {/* username */}
            <div>
              <label className="text-sm font-semibold">
                Username <span className="text-rose-400">*</span>
              </label>
              <div className="mt-1 flex items-center rounded-xl border border-foreground/15 bg-foreground/[0.04] px-3">
                <span className="text-muted-foreground">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="yourname"
                  maxLength={20}
                  className="w-full bg-transparent px-1 py-2.5 text-sm outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">3–20 chars · letters, numbers, underscores.</p>
            </div>

            {/* display name */}
            <div>
              <label className="text-sm font-semibold">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How your name shows (optional)"
                maxLength={40}
                className="mt-1 w-full rounded-xl border border-foreground/15 bg-foreground/[0.04] px-3 py-2.5 text-sm outline-none"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
                {error}
              </div>
            )}

            <button
              onClick={save}
              disabled={saving || username.trim().length < 3}
              className="w-full rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 py-3 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : existing ? "Save changes" : "Create profile"}
            </button>
          </div>
        )}
      </main>
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileInner />
    </Suspense>
  );
}

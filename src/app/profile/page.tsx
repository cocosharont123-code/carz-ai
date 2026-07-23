"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { SiteHeader } from "@/components/site-header";
import { Avatar } from "@/components/default-avatar";
import { Button, PageMasthead, Skeleton } from "@/components/ui/editorial";

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
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError(d?.error || `Couldn't save (error ${res.status}). Please try again.`);
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
      <main className="mx-auto w-full max-w-lg px-5 py-10">
        <PageMasthead eyebrow="Your account" title={existing ? "Edit" : "Profile"} />

        {loading ? (
          <Skeleton className="mt-8 h-64 w-full" />
        ) : authStatus === "unauthenticated" ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-10 text-center">
            <h3 className="display text-3xl">Sign in</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm ">Set up your profile to appear on the board.</p>
            <button
              onClick={() => signIn("google", { callbackUrl: "/profile" })}
              className="mt-6 inline-flex bg-white px-5 py-2.5 font-semibold text-[#1f1f1f] transition hover:brightness-95"
            >
              Continue with Google
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-7">
            {/* picture + preview */}
            <div className="flex items-center gap-4">
              <Avatar src={image} size={80} rounded="0" />
              <div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="util-label border border-white/20 px-4 py-2  transition hover:border-carz "
                >
                  {image ? "Change" : "Upload"}
                </button>
                {image && (
                  <button onClick={() => setImage("")} className="util-label ml-3  ">
                    Remove
                  </button>
                )}
                <p className="mt-2 text-xs ">Optional — empty gives the animated car avatar.</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            </div>

            <div>
              <label className="util-label ">Username <span className="">*</span></label>
              <div className="mt-2 flex items-center rounded-xl border border-white/15 bg-white/[0.03] px-3">
                <span className="">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="yourname"
                  maxLength={20}
                  className="w-full bg-transparent px-1 py-3 text-sm  outline-none "
                />
              </div>
              <p className="mt-1.5 text-xs ">3–20 chars · letters, numbers, underscores.</p>
            </div>

            <div>
              <label className="util-label ">Display name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How your name shows (optional)"
                maxLength={40}
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-3 text-sm  outline-none "
              />
            </div>

            {error && <div className="border border-carz/40 bg-carz/10 p-3 text-sm ">{error}</div>}

            <Button onClick={save} disabled={saving || username.trim().length < 3} size="lg" className="w-full">
              {saving ? "Saving…" : existing ? "Save changes" : "Create profile"}
            </Button>
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

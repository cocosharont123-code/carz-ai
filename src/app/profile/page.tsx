"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/default-avatar";
import { DeleteAccount } from "@/components/delete-account";
import { Button, PageMasthead, Skeleton } from "@/components/ui/editorial";
import { GoogleSignInButton } from "@/components/google-sign-in";

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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Days available in a month, 29 February included — it is a birthday even in
 *  the years it is not a date. */
function daysInMonth(mm: string): string[] {
  const n = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][Number(mm) - 1] ?? 31;
  return Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, "0"));
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
  // "MM-DD". No year: there is nowhere to put one.
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
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
          setBirthday(d.profile.birthday || "");
        }
        // A name always exists — it just can't be *changed* while storage is
        // unreachable, so disable saving rather than letting every submit 503.
        if (d.configured === false || d.unavailable) {
          setBlocked(true);
          setError("Your name is set, but renaming isn't available right now. Try again later.");
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
        body: JSON.stringify({ username, displayName, image, birthday }),
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
      <main className="mx-auto w-full max-w-lg px-5 py-10">
        <PageMasthead eyebrow="Your account" title="Your profile" />

        {loading ? (
          <Skeleton className="mt-8 h-64 w-full" />
        ) : authStatus === "unauthenticated" ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-10 text-center">
            <h3 className="display text-3xl">Sign in</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm ">Set up your profile to appear on the board.</p>
            <GoogleSignInButton callbackUrl="/profile" />
          </div>
        ) : (
          <div className="mt-8 space-y-7">
            {/* The photo is the control. Tapping it opens the picker — a
                separate "Change" button beside a preview makes the picture
                look like decoration rather than the thing you press. */}
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={image ? "Change your profile photo" : "Add a profile photo"}
                className="press group relative rounded-full"
              >
                <Avatar src={image} size={132} />
                <span className="absolute inset-0 flex items-end justify-center rounded-full bg-gradient-to-t from-black/70 to-transparent pb-3 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="util-label text-white">{image ? "Change" : "Add photo"}</span>
                </span>
              </button>

              <div className="mt-3 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="util-label opacity-70 transition-opacity hover:opacity-100"
                >
                  {image ? "Change photo" : "Add photo"}
                </button>
                {image && (
                  <button
                    type="button"
                    onClick={() => setImage("")}
                    className="util-label opacity-70 transition-opacity hover:opacity-100"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs opacity-60">Empty gives the animated car avatar.</p>
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
              <p className="mt-1.5 text-xs ">
                We picked this for you — change it if you like. 3–20 chars · letters, numbers, underscores.
              </p>
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

            <div>
              <label className="util-label">Birthday</label>
              {/* Two selects rather than a date input. A date field cannot be
                  filled without a year, and the year is the half that turns a
                  birthday into an identifier — so there is nowhere to enter one
                  and nowhere to store one. */}
              <div className="mt-2 flex gap-3">
                <select
                  aria-label="Birth month"
                  value={birthday.slice(0, 2)}
                  onChange={(e) => setBirthday(e.target.value ? `${e.target.value}-${birthday.slice(3) || "01"}` : "")}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-3 text-sm outline-none"
                >
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>
                  ))}
                </select>
                <select
                  aria-label="Birth day"
                  value={birthday.slice(3)}
                  disabled={!birthday.slice(0, 2)}
                  onChange={(e) => setBirthday(`${birthday.slice(0, 2)}-${e.target.value}`)}
                  className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-3 py-3 text-sm outline-none disabled:opacity-40"
                >
                  {/* A placeholder that matches the empty value: without one
                      React has a select whose value is not among its options. */}
                  <option value="">Day</option>
                  {daysInMonth(birthday.slice(0, 2)).map((d) => (
                    <option key={d} value={d}>{Number(d)}</option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 text-xs opacity-60">
                Day and month only — we never ask for the year.
                {birthday && (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setBirthday("")}
                      className="underline underline-offset-2 hover:opacity-80"
                    >
                      Clear
                    </button>
                  </>
                )}
              </p>
            </div>

            {error && <div className="border border-carz/40 bg-carz/10 p-3 text-sm ">{error}</div>}

            <Button
              onClick={save}
              disabled={blocked || username.trim().length < 3}
              loading={saving}
              size="lg"
              className="w-full"
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>

            <DeleteAccount />
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

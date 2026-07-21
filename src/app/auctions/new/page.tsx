"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { SiteHeader } from "@/components/site-header";

function downscale(dataUrl: string, max = 900, quality = 0.7): Promise<string> {
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

function NewAuctionInner() {
  const { status } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const [title, setTitle] = useState("");
  const [make, setMake] = useState(params.get("make") || "");
  const [model, setModel] = useState(params.get("model") || "");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [startingBid, setStartingBid] = useState("");
  const [contact, setContact] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const m = params.get("make");
    const mo = params.get("model");
    if (m && mo && !title) setTitle(`${m} ${mo}`.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.readAsDataURL(file);
    });
    setImage(await downscale(raw));
  }

  async function submit() {
    setError("");
    if (!title.trim()) return setError("Give your listing a title.");
    if (!image) return setError("Add a photo of the car.");
    if (!contact.trim()) return setError("Add contact info (revealed only to the winner).");
    setSaving(true);
    try {
      const res = await fetch("/api/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          make,
          model,
          description,
          image,
          startingBid: Number(startingBid) || 0,
          contact,
          durationDays,
        }),
      });
      const d = await res.json();
      if (!d.ok) {
        if (d.needUsername) {
          router.push("/profile?next=/auctions/new");
          return;
        }
        setError(d.error || "Couldn't create the listing.");
        return;
      }
      router.push(`/auctions/${d.id}`);
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
        <h1 className="text-3xl font-extrabold tracking-tight">List your car</h1>
        <p className="mt-1 text-muted-foreground">
          Start a bidding war. When the timer ends, the highest bidder gets your contact info to arrange the sale.
        </p>

        {status === "unauthenticated" ? (
          <div className="mt-8 rounded-3xl border border-foreground/[0.06] bg-card p-8 text-center">
            <div className="text-4xl">🔑</div>
            <h3 className="mt-3 text-lg font-bold">Sign in to list a car</h3>
            <button
              onClick={() => signIn("google", { callbackUrl: "/auctions/new" })}
              className="mt-4 rounded-xl bg-white px-5 py-2.5 font-semibold text-[#1f1f1f]"
            >
              Continue with Google
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {/* photo */}
            <div>
              <label className="text-sm font-semibold">Photo</label>
              <div className="mt-1 flex items-center gap-4">
                <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-foreground/[0.04]">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="car" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">🚗</div>
                  )}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="rounded-xl border border-foreground/15 bg-foreground/[0.06] px-4 py-2 text-sm font-semibold hover:bg-foreground/[0.12]"
                >
                  {image ? "Change photo" : "Upload photo"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              </div>
            </div>

            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 2015 BMW M4 — low miles"
                maxLength={100}
                className="input"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Make">
                <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="BMW" className="input" />
              </Field>
              <Field label="Model">
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="M4" className="input" />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Condition, mileage, mods, history…"
                maxLength={1500}
                rows={4}
                className="input resize-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Starting bid (USD)">
                <input
                  value={startingBid}
                  onChange={(e) => setStartingBid(e.target.value.replace(/[^0-9]/g, ""))}
                  inputMode="numeric"
                  placeholder="15000"
                  className="input"
                />
              </Field>
              <Field label="Auction length">
                <select
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="input"
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                </select>
              </Field>
            </div>

            <Field label="Contact info for the winner">
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone, email or @handle"
                maxLength={300}
                className="input"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                🔒 Encrypted and hidden. Only the winning bidder sees this after the auction ends.
              </p>
            </Field>

            {error && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
            )}

            <button
              onClick={submit}
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Listing…" : "Start the auction"}
            </button>
          </div>
        )}
      </main>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          background: color-mix(in oklab, var(--foreground) 4%, transparent);
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: color-mix(in oklab, var(--foreground) 25%, transparent);
        }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export default function NewAuctionPage() {
  return (
    <Suspense fallback={null}>
      <NewAuctionInner />
    </Suspense>
  );
}

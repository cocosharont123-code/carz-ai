"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { ImagePlus, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PageMasthead, Button, Spinner } from "@/components/ui/editorial";
import { useImageUpload } from "@/components/hooks/use-image-upload";
import { cn } from "@/lib/utils";

const CAPTION_MAX = 300;

/**
 * Re-encode to a sane size before upload. Phone photos are 4–12MB; the feed
 * renders them at roughly card width, so 1440px is already generous and keeps
 * the request small enough to survive a mobile connection.
 */
function downscale(dataUrl: string, max = 1440, quality = 0.82): Promise<string> {
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

async function objectUrlToDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((r) => r.blob());
  return await new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(blob);
  });
}

export default function NewPostPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const [caption, setCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const { previewUrl, fileInputRef, handleThumbnailClick, handleFileChange, handleRemove } =
    useImageUpload();

  const remaining = CAPTION_MAX - caption.length;

  async function submit() {
    if (!previewUrl) {
      setError("Add a photo first.");
      return;
    }
    setError("");
    setPosting(true);
    try {
      const raw = await objectUrlToDataUrl(previewUrl);
      const image = await downscale(raw);
      const res = await fetch("/api/feed/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, caption }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Couldn't post that.");
        setPosting(false);
        return;
      }
      router.push("/feed");
      router.refresh();
    } catch {
      setError("Network error — your post wasn't saved.");
      setPosting(false);
    }
  }

  if (authStatus === "unauthenticated") {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl px-5 py-10">
          <PageMasthead eyebrow="Share a spot" title="New post" />
          <div className="mt-8 rounded-3xl border border-white/10 bg-card text-card-foreground p-8 text-center">
            <h2 className="text-lg font-bold">Sign in to post</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">
              You need an account to share a car on the feed.
            </p>
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/feed/new" })}
              className="press mt-5 inline-flex rounded-full bg-black px-6 py-2.5 text-sm font-bold text-white transition hover:opacity-90"
            >
              Sign in
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-5 py-10">
        <PageMasthead
          eyebrow="Share a spot"
          title="New post"
          action={
            <Button href="/feed" size="sm" variant="ghost">
              Cancel
            </Button>
          }
        />

        <div className="mt-6 rounded-3xl border border-white/10 bg-card text-card-foreground p-5">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          {!previewUrl ? (
            <div
              onClick={handleThumbnailClick}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith("image/")) {
                  handleFileChange({
                    target: { files: [file] },
                  } as unknown as React.ChangeEvent<HTMLInputElement>);
                }
              }}
              className={cn(
                "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/20 bg-black/[0.03] transition-colors hover:bg-black/[0.06]",
                isDragging && "border-black/50 bg-black/[0.08]",
              )}
            >
              <ImagePlus className="h-7 w-7 opacity-50" strokeWidth={1.5} aria-hidden />
              <div className="text-center">
                <p className="text-sm font-semibold">Click to add a photo</p>
                <p className="text-xs opacity-50">or drag and drop</p>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Your post" className="aspect-[4/3] w-full object-cover" />
              <button
                type="button"
                onClick={handleRemove}
                aria-label="Remove photo"
                className="press absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}

          <div className="mt-4">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
              rows={3}
              placeholder="Say something about it — where you found it, what caught your eye…"
              className="w-full resize-none rounded-2xl border border-black/10 bg-black/[0.03] p-3.5 text-[13px] leading-relaxed outline-none transition focus:border-black/30"
            />
            <div className="mt-1 flex justify-end">
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  remaining <= 20 ? "font-semibold opacity-80" : "opacity-40",
                )}
              >
                {remaining}
              </span>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-xl border border-black/15 bg-black/[0.05] p-3 text-[13px] font-medium"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!previewUrl || posting}
            aria-busy={posting || undefined}
            className="press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {posting && <Spinner className="h-4 w-4" />}
            {posting ? "Posting…" : "Post"}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] uppercase tracking-wide opacity-40">
          <Link href="/feed" className="hover:opacity-80">
            Back to feed
          </Link>
        </p>
      </main>
    </>
  );
}

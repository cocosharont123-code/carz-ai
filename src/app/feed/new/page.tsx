"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Video, X } from "lucide-react";
import { PageMasthead, Button, Spinner } from "@/components/ui/editorial";
import { VideoEditor, EMPTY_EDIT } from "@/components/feed/video-editor";
import type { VideoEdit } from "@/components/feed/feed-video";
import { cn } from "@/lib/utils";
import { GoogleSignInButton } from "@/components/google-sign-in";
import { checkUploadPath, looksLikeVideo } from "@/lib/safe-media";

const CAPTION_MAX = 300;
/** Beyond this a clip stops being a spot and starts being a film. */
const MAX_VIDEO_SECONDS = 90;

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

/** Read duration without rendering the file — needed before the editor opens. */
function probeDuration(objectUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration * 1000 : 0);
    v.onerror = () => reject(new Error("That video couldn't be read."));
    v.src = objectUrl;
  });
}

/**
 * Grab a still to use as the post's poster frame.
 *
 * The naive version — seek, then drawImage — paints black more often than not.
 * A <video> will report a currentTime it has not decoded a frame for yet, and
 * a canvas drawn from it then is simply empty. That is where the black tiles on
 * a channel come from: a black JPEG was captured and uploaded, so the grid was
 * faithfully showing the poster it was given.
 *
 * So: wait for real frame data, wait for the seek to land, wait one more frame
 * for the decoder, then draw — and if what comes back is still black, try a
 * little further into the clip, since plenty of videos open on a fade.
 */
function waitFor(video: HTMLVideoElement, event: string, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener(event, finish);
      resolve();
    };
    video.addEventListener(event, finish, { once: true });
    // Never hang on a video that will not fire: a black poster beats a
    // composer that never returns.
    window.setTimeout(finish, timeoutMs);
  });
}

/** Roughly, is this canvas all black? Sampled, not scanned. */
function looksBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return true;
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return true;
  let lit = 0;
  const step = 16;
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      if (data[i] > 14 || data[i + 1] > 14 || data[i + 2] > 14) lit++;
      if (lit > 12) return false;
    }
  }
  return true;
}

async function drawAt(video: HTMLVideoElement, atSec: number): Promise<HTMLCanvasElement | null> {
  if (Math.abs(video.currentTime - atSec) > 0.05) {
    video.currentTime = atSec;
    await waitFor(video, "seeked");
  }
  // HAVE_CURRENT_DATA. Without this the seek can resolve before a frame exists.
  if (video.readyState < 2) await waitFor(video, "loadeddata");
  // One more frame for the decoder to actually present it.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 960;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function captureFrame(video: HTMLVideoElement, atSec: number): Promise<string> {
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  // The in-point first, then a little way past it, then a second in — a clip
  // that is black at all three is a black clip.
  const tries = [atSec, atSec + 0.4, atSec + 1].filter(
    (t) => !duration || t < duration - 0.05,
  );
  let last: HTMLCanvasElement | null = null;
  for (const t of tries.length ? tries : [atSec]) {
    const canvas = await drawAt(video, t);
    if (!canvas) continue;
    last = canvas;
    if (!looksBlank(canvas)) return canvas.toDataURL("image/jpeg", 0.82);
  }
  return last ? last.toDataURL("image/jpeg", 0.82) : "";
}

type Media = { objectUrl: string; blobUrl: string; durationMs: number };

export default function NewPostPage() {
  const router = useRouter();
  const { status: authStatus } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLVideoElement>(null);

  const [media, setMedia] = useState<Media | null>(null);
  const [edit, setEdit] = useState<VideoEdit>(EMPTY_EDIT);
  const [caption, setCaption] = useState("");
  const [carName, setCarName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const remaining = CAPTION_MAX - caption.length;
  const busy = uploading || posting;

  async function pick(file: File) {
    setError("");

    // Video only. The accept filter already narrows the picker, but a drag-drop
    // bypasses it entirely, so the check has to be here too.
    if (!file.type.startsWith("video/")) {
      setError(
        file.type.startsWith("image/")
          ? "The feed takes video only — photos aren't accepted."
          : "Pick a video file.",
      );
      return;
    }

    // Checked before a byte moves. Three things the file has to be, in the
    // order that fails cheapest first.
    //
    // 1. A name we accept. The extension travels into the public URL and into
    //    whatever handles the file next, so .php, .jsp and the rest of the
    //    executable list are refused here as well as on the server.
    const nameCheck = checkUploadPath(`feed/video/${file.name}`, "video");
    if (!nameCheck.ok) {
      setError(nameCheck.reason);
      return;
    }

    // 2. Bytes that are actually a video container. A file's type is whatever
    //    it was named — reading the header is the difference between "it says
    //    mp4" and "it is one".
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!looksLikeVideo(head)) {
      setError("That file isn't a video.");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setUploading(true);
    try {
      // 3. Something the browser can actually decode. A truncated or corrupt
      //    clip passes the header check and still will not play for anyone.
      const durationMs = await probeDuration(objectUrl);
      if (!Number.isFinite(durationMs) || durationMs <= 0) {
        setError("That video won't play — try re-exporting it.");
        setUploading(false);
        URL.revokeObjectURL(objectUrl);
        return;
      }
      if (durationMs > MAX_VIDEO_SECONDS * 1000) {
        setError(`Clips are ${MAX_VIDEO_SECONDS} seconds or shorter — trim it first.`);
        setUploading(false);
        return;
      }
      // Straight to Blob: a video is far past what a serverless body carries,
      // so it never passes through our own API.
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`feed/video/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/feed/upload",
      });
      setMedia({ objectUrl, blobUrl: blob.url, durationMs });
      setEdit({ ...EMPTY_EDIT });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that video.");
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    if (media) URL.revokeObjectURL(media.objectUrl);
    setMedia(null);
    setEdit(EMPTY_EDIT);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit() {
    if (!media) {
      setError("Add a video first.");
      return;
    }
    setError("");
    setPosting(true);
    try {
      // Poster is taken at the in-point, so the still the slide shows matches
      // the first frame the clip actually plays.
      const v = posterRef.current;
      if (!v) throw new Error("Couldn't read that video.");
      const frame = await captureFrame(v, edit.trimStartMs / 1000);
      const image = frame ? await downscale(frame) : "";
      if (!image) throw new Error("Couldn't grab a preview frame.");

      const res = await fetch("/api/feed/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image,
          caption,
          carName: carName.trim(),
          videoUrl: media.blobUrl,
          durationMs: media.durationMs,
          edit,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Couldn't post that.");
        setPosting(false);
        return;
      }
      router.push("/feed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error — your post wasn't saved.");
      setPosting(false);
    }
  }

  if (authStatus === "unauthenticated") {
    return (
      <>
        <main className="mx-auto w-full max-w-xl px-5 py-10">
          <PageMasthead eyebrow="Share a spot" title="New post" />
          <div className="mt-8 rounded-3xl border border-white/10 bg-card text-card-foreground p-8 text-center">
            <h2 className="text-lg font-bold">Sign in to post</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] opacity-60">
              You need an account to share a car on the feed.
            </p>
            <GoogleSignInButton callbackUrl="/feed/new" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
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
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
            }}
          />

          {!media ? (
            <div
              onClick={() => !busy && fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
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
                const f = e.dataTransfer.files?.[0];
                if (f) void pick(f);
              }}
              className={cn(
                "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-black/20 bg-black/[0.03] transition-colors hover:bg-black/[0.06]",
                isDragging && "border-black/50 bg-black/[0.08]",
                busy && "pointer-events-none opacity-60",
              )}
            >
              {uploading ? (
                <>
                  <Spinner className="h-6 w-6" />
                  <p className="text-sm font-semibold">Uploading video…</p>
                </>
              ) : (
                <>
                  <Video className="h-7 w-7 opacity-50" strokeWidth={1.5} aria-hidden />
                  <div className="text-center">
                    <p className="text-sm font-semibold">Click to add a video</p>
                    <p className="text-xs opacity-50">
                      or drag and drop · clips up to {MAX_VIDEO_SECONDS}s
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide opacity-40">
                      Video only — no photos
                    </p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide opacity-50">
                  Video · {(media.durationMs / 1000).toFixed(1)}s
                </span>
                <button
                  type="button"
                  onClick={clear}
                  className="press inline-flex items-center gap-1 rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-semibold transition hover:bg-black/[0.1]"
                >
                  <X className="h-3 w-3" aria-hidden />
                  Replace
                </button>
              </div>

              {/* Off-screen source for the poster grab — kept out of the editor
                  so seeking for a frame never disturbs the preview. */}
              <video
                ref={posterRef}
                src={media.objectUrl}
                muted
                playsInline
                preload="metadata"
                className="hidden"
              />

              <VideoEditor
                src={media.objectUrl}
                durationMs={media.durationMs}
                edit={edit}
                onChange={setEdit}
              />
            </>
          )}

          {/* Required. A feed of cars where half the clips do not say which
              car is a feed you cannot search, and the person who filmed it is
              the one person who definitely knows. */}
          <div className="mt-4">
            <label htmlFor="car-name" className="util-label opacity-60">
              Which car is it?
            </label>
            <input
              id="car-name"
              value={carName}
              onChange={(e) => setCarName(e.target.value.slice(0, 60))}
              placeholder="e.g. Porsche 911 GT3 RS"
              autoComplete="off"
              className="mt-1.5 min-h-11 w-full rounded-2xl border border-black/10 bg-black/[0.03] px-3.5 text-[13px] outline-none transition placeholder:opacity-40 focus:border-black/30"
            />
          </div>

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
            disabled={!media || !carName.trim() || busy}
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

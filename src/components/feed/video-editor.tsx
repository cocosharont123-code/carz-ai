"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Upload, X, Scissors, Volume2 } from "lucide-react";
import { MUSIC_TRACKS } from "@/lib/feed-music";
import { Spinner } from "@/components/ui/editorial";
import { cn } from "@/lib/utils";
import type { VideoEdit } from "@/components/feed/feed-video";

export const EMPTY_EDIT: VideoEdit = {
  trimStartMs: 0,
  trimEndMs: 0,
  muteOriginal: false,
  musicUrl: "",
  musicTitle: "",
  musicVolume: 0.8,
  musicStartMs: 0,
};

function fmt(ms: number): string {
  const s = Math.max(0, ms / 1000);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, "0")}`;
}

/**
 * The in-app editor: trim in/out, mute the original, lay a track underneath.
 *
 * Everything here is non-destructive. The preview below plays the source file
 * with the edit applied live, which is exactly what the feed will do — so what
 * you see here is what gets posted, without waiting on an export.
 */
export function VideoEditor({
  src,
  durationMs,
  edit,
  onChange,
}: {
  src: string;
  durationMs: number;
  edit: VideoEdit;
  onChange: (next: VideoEdit) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState("");

  const set = (patch: Partial<VideoEdit>) => onChange({ ...edit, ...patch });

  const endMs = edit.trimEndMs > 0 ? edit.trimEndMs : durationMs;
  const clipMs = Math.max(0, endMs - edit.trimStartMs);

  // Scrub the preview to whichever handle moved, so trimming is visual.
  function seekTo(ms: number) {
    const v = videoRef.current;
    if (v) v.currentTime = ms / 1000;
  }

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = edit.musicVolume;
  }, [edit.musicVolume]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = edit.muteOriginal;
  }, [edit.muteOriginal]);

  async function uploadOwnAudio(file: File) {
    setAudioError("");
    setUploadingAudio(true);
    try {
      // Same direct-to-Blob path as the video: audio files are well past what a
      // serverless request body will carry.
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`feed/audio/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/feed/upload",
      });
      set({ musicUrl: blob.url, musicTitle: file.name.replace(/\.[^.]+$/, "").slice(0, 80) });
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "Couldn't add that audio.");
    } finally {
      setUploadingAudio(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.03] p-4">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide opacity-50">
        <Scissors className="h-3 w-3" aria-hidden />
        Edit
      </h3>

      {/* Preview: the source file with the edit applied, same as the feed. */}
      <div className="mt-3 overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          src={src}
          playsInline
          controls
          preload="metadata"
          className="aspect-[4/3] w-full object-contain"
        />
      </div>
      {edit.musicUrl && <audio ref={audioRef} src={edit.musicUrl} loop preload="metadata" />}

      {/* --- Trim --- */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold">Trim</span>
          <span className="text-[11px] tabular-nums opacity-60">
            {fmt(edit.trimStartMs)} – {fmt(endMs)} · {(clipMs / 1000).toFixed(1)}s
          </span>
        </div>

        <label className="mt-2 block">
          <span className="text-[11px] uppercase tracking-wide opacity-50">Start</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, durationMs)}
            step={100}
            value={edit.trimStartMs}
            onChange={(e) => {
              const v = Number(e.target.value);
              // Keep at least a quarter-second of clip so the out point can
              // never cross the in point.
              const capped = Math.min(v, endMs - 250);
              set({ trimStartMs: Math.max(0, capped) });
              seekTo(capped);
            }}
            className="mt-1 w-full accent-black"
          />
        </label>

        <label className="mt-2 block">
          <span className="text-[11px] uppercase tracking-wide opacity-50">End</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, durationMs)}
            step={100}
            value={endMs}
            onChange={(e) => {
              const v = Math.max(Number(e.target.value), edit.trimStartMs + 250);
              // Snapping the far right back to 0 keeps "to the end" meaningful
              // if the source is ever replaced.
              set({ trimEndMs: v >= durationMs ? 0 : v });
              seekTo(v);
            }}
            className="mt-1 w-full accent-black"
          />
        </label>
      </div>

      {/* --- Original audio --- */}
      <label className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold">Mute original sound</span>
        <input
          type="checkbox"
          checked={edit.muteOriginal}
          onChange={(e) => set({ muteOriginal: e.target.checked })}
          className="h-4 w-4 accent-black"
        />
      </label>

      {/* --- Music --- */}
      <div className="mt-4 border-t border-black/10 pt-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Music className="h-3.5 w-3.5" aria-hidden />
            Music
          </span>
          {edit.musicUrl && (
            <button
              type="button"
              onClick={() => set({ musicUrl: "", musicTitle: "" })}
              className="press inline-flex items-center gap-1 rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-semibold transition hover:bg-black/[0.1]"
            >
              <X className="h-3 w-3" aria-hidden />
              Remove
            </button>
          )}
        </div>

        {MUSIC_TRACKS.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {MUSIC_TRACKS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => set({ musicUrl: t.src, musicTitle: `${t.title} — ${t.artist}` })}
                className={cn(
                  "press rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                  edit.musicUrl === t.src
                    ? "bg-black text-white"
                    : "bg-black/[0.06] hover:bg-black/[0.1]",
                )}
              >
                {t.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[12px] leading-relaxed opacity-50">
            No built-in tracks yet — add royalty-free files to{" "}
            <code className="rounded bg-black/[0.06] px-1">public/music/</code> and list them in{" "}
            <code className="rounded bg-black/[0.06] px-1">src/lib/feed-music.ts</code>. You can
            use your own audio in the meantime.
          </p>
        )}

        <input
          ref={audioFileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadOwnAudio(f);
          }}
        />
        <button
          type="button"
          onClick={() => audioFileRef.current?.click()}
          disabled={uploadingAudio}
          className="press mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/[0.06] px-3 py-1.5 text-[12px] font-semibold transition hover:bg-black/[0.1] disabled:opacity-50"
        >
          {uploadingAudio ? <Spinner className="h-3 w-3" /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
          {uploadingAudio ? "Uploading…" : "Use my own audio"}
        </button>

        {audioError && (
          <p role="alert" className="mt-2 text-[12px] font-medium opacity-80">
            {audioError}
          </p>
        )}

        {edit.musicUrl && (
          <>
            <p className="mt-2.5 truncate text-[12px] font-semibold">{edit.musicTitle}</p>
            <label className="mt-2 block">
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-50">
                <Volume2 className="h-3 w-3" aria-hidden />
                Music volume · {Math.round(edit.musicVolume * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={edit.musicVolume}
                onChange={(e) => set({ musicVolume: Number(e.target.value) })}
                className="mt-1 w-full accent-black"
              />
            </label>
          </>
        )}
      </div>

      <p className="mt-4 border-t border-black/10 pt-3 text-[11px] leading-relaxed opacity-45">
        Edits are applied when the clip plays in Carz — the original file is kept as
        uploaded, so nothing is re-encoded and posting stays instant.
      </p>
    </div>
  );
}

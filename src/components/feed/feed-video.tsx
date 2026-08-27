"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Music } from "lucide-react";
import { cn } from "@/lib/utils";

export type VideoEdit = {
  trimStartMs: number;
  trimEndMs: number;
  muteOriginal: boolean;
  musicUrl: string;
  musicTitle: string;
  musicVolume: number;
  musicStartMs: number;
};

/**
 * Plays a video through its edit without re-encoding anything.
 *
 * The trim is enforced by seeking on start and looping at the out point; the
 * music is a second element kept in step with the video's clock. Playback is
 * click-to-start rather than autoplaying: music needs sound, and every browser
 * blocks audible autoplay without a gesture — a muted autoplay would silently
 * drop the whole point of the feature.
 */
export function FeedVideo({
  videoUrl,
  posterUrl,
  edit,
  className,
}: {
  videoUrl: string;
  posterUrl: string;
  edit: VideoEdit;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const startSec = edit.trimStartMs / 1000;
  const endSec = edit.trimEndMs > 0 ? edit.trimEndMs / 1000 : 0;
  const hasMusic = !!edit.musicUrl;

  /** Put the music where the video's position says it should be. */
  const syncMusic = useCallback(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a || !hasMusic) return;
    const into = Math.max(0, v.currentTime - startSec);
    const target = edit.musicStartMs / 1000 + into;
    // Only correct real drift — reassigning currentTime every frame stutters.
    if (Number.isFinite(target) && Math.abs(a.currentTime - target) > 0.25) {
      a.currentTime = target;
    }
  }, [edit.musicStartMs, hasMusic, startSec]);

  const rewind = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = startSec;
    const a = audioRef.current;
    if (a && hasMusic) a.currentTime = edit.musicStartMs / 1000;
  }, [edit.musicStartMs, hasMusic, startSec]);

  async function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      audioRef.current?.pause();
      return;
    }
    // Past the out point from a previous run — start the clip over.
    if (v.currentTime < startSec || (endSec && v.currentTime >= endSec)) rewind();
    try {
      await v.play();
      if (hasMusic && !muted) await audioRef.current?.play();
    } catch {
      /* playback refused (low power mode, codec) — the poster stays up */
    }
  }

  // Keep the original track's audio in step with the mute control. The edit's
  // own mute is permanent; the toggle is the viewer's, on top of it.
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = edit.muteOriginal || muted;
    const a = audioRef.current;
    if (a) a.volume = muted ? 0 : Math.max(0, Math.min(1, edit.musicVolume));
  }, [edit.muteOriginal, edit.musicVolume, muted]);

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    if (endSec && v.currentTime >= endSec) {
      rewind();
      void v.play();
      if (hasMusic && !muted) void audioRef.current?.play();
      return;
    }
    syncMusic();
  }

  return (
    <div className={cn("relative overflow-hidden bg-black", className)}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={posterUrl || undefined}
        playsInline
        preload="metadata"
        className="aspect-[4/3] w-full object-cover"
        onLoadedMetadata={rewind}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          audioRef.current?.pause();
        }}
        onClick={toggle}
      />

      {hasMusic && <audio ref={audioRef} src={edit.musicUrl} loop preload="metadata" />}

      {/* Play overlay — only while stopped, so it never covers the clip. */}
      {!playing && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center bg-black/25 transition hover:bg-black/35"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/50 bg-white/90 text-black shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
            <Play className="ml-0.5 h-6 w-6" fill="currentColor" strokeWidth={0} aria-hidden />
          </span>
        </button>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
        {playing && (
          <button
            type="button"
            onClick={toggle}
            aria-label="Pause"
            className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
          >
            <Pause className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} aria-hidden />
          </button>
        )}

        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
        >
          {muted ? (
            <VolumeX className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Volume2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>

        {edit.musicTitle && (
          <span className="pointer-events-none flex min-w-0 items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
            <Music className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{edit.musicTitle}</span>
          </span>
        )}
      </div>
    </div>
  );
}

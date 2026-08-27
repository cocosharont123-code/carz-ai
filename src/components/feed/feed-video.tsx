"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Music } from "lucide-react";
import { cn } from "@/lib/utils";

/** Window for a second tap to count as a double. Long enough for a thumb, short
 *  enough that a plain pause doesn't feel laggy. */
const DOUBLE_TAP_MS = 260;

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
 * Plays a clip through its edit without re-encoding: seek to the in-point, loop
 * at the out-point, run the music underneath in step with the video's clock.
 *
 * In the reel scroller this is driven by `active` — the slide currently filling
 * the viewport plays, everything else is paused and rewound so scrolling back
 * starts the clip over. Autoplay is always muted to begin with, because every
 * browser blocks audible autoplay; `muted` is lifted to the scroller so
 * unmuting once carries down the whole feed, the way it does on TikTok.
 */
export function FeedVideo({
  videoUrl,
  posterUrl,
  edit,
  active = true,
  muted = false,
  fill = false,
  onDoubleTap,
  className,
}: {
  videoUrl: string;
  posterUrl: string;
  edit: VideoEdit;
  /** This slide is the one on screen. Off-screen slides stay paused. */
  active?: boolean;
  muted?: boolean;
  /** Fill the parent instead of holding a 4:3 box. */
  fill?: boolean;
  /** Two quick taps on the clip. When set, a single tap is delayed to tell them apart. */
  onDoubleTap?: () => void;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [paused, setPaused] = useState(false);

  // Clear a manual pause when the slide scrolls away, so coming back to it
  // plays rather than showing a stale play button. Adjusting state during
  // render on a changed prop is React's documented pattern for this — an
  // effect would queue a second render pass for something derivable here.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active && paused) setPaused(false);
  }

  const startSec = edit.trimStartMs / 1000;
  const endSec = edit.trimEndMs > 0 ? edit.trimEndMs / 1000 : 0;
  const hasMusic = !!edit.musicUrl;

  const rewind = useCallback(() => {
    const v = videoRef.current;
    if (v) v.currentTime = startSec;
    const a = audioRef.current;
    if (a && hasMusic) a.currentTime = edit.musicStartMs / 1000;
  }, [edit.musicStartMs, hasMusic, startSec]);

  /** Nudge the music back onto the video's clock when it drifts. */
  const syncMusic = useCallback(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v || !a || !hasMusic) return;
    const target = edit.musicStartMs / 1000 + Math.max(0, v.currentTime - startSec);
    // Only correct real drift — reassigning every frame stutters.
    if (Number.isFinite(target) && Math.abs(a.currentTime - target) > 0.25) {
      a.currentTime = target;
    }
  }, [edit.musicStartMs, hasMusic, startSec]);

  // Seeking is kept in its own effect, keyed only on `active`. Scrolling to a
  // slide starts its clip from the top; pausing and resuming must not, and it
  // used to, because rewind lived in the play/pause effect below and fired
  // again on every resume.
  useEffect(() => {
    rewind();
  }, [active, rewind]);

  // Play/pause only — this one never touches the playhead, so resuming picks up
  // exactly where the tap stopped it, and toggling mute doesn't jump either.
  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (!v) return;

    if (active && !paused) {
      // If the browser refuses — audible autoplay outside the muted scroller,
      // low power mode — fall back to showing the play button rather than
      // leaving a poster that looks broken.
      void v.play().catch(() => setPaused(true));
      if (hasMusic && !muted) void a?.play().catch(() => {});
    } else {
      v.pause();
      a?.pause();
    }
  }, [active, paused, muted, hasMusic]);

  // The edit's mute is the poster's choice and permanent; the viewer's mute
  // rides on top of it.
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = edit.muteOriginal || muted;
    const a = audioRef.current;
    if (!a) return;
    a.volume = Math.max(0, Math.min(1, edit.musicVolume));
    a.muted = muted;
    if (!muted && active && !paused) void a.play().catch(() => {});
  }, [edit.muteOriginal, edit.musicVolume, muted, active, paused]);

  /**
   * One tap pauses, two taps like. They can't both fire on the same gesture, so
   * the single tap waits out the double-tap window before acting — otherwise a
   * double tap would pause and unpause on its way to registering the like.
   *
   * Without an `onDoubleTap` handler there is nothing to wait for and the tap
   * acts immediately.
   */
  const tapTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimer.current !== null) clearTimeout(tapTimer.current);
    };
  }, []);

  function handleTap() {
    if (!onDoubleTap) {
      setPaused((p) => !p);
      return;
    }
    if (tapTimer.current !== null) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDoubleTap();
      return;
    }
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      setPaused((p) => !p);
    }, DOUBLE_TAP_MS);
  }

  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    if (endSec && v.currentTime >= endSec) {
      rewind();
      void v.play().catch(() => {});
      if (hasMusic && !muted) void audioRef.current?.play().catch(() => {});
      return;
    }
    syncMusic();
  }

  return (
    <div className={cn("relative", fill ? "h-full w-full" : "overflow-hidden bg-black", className)}>
      <video
        ref={videoRef}
        src={videoUrl}
        poster={posterUrl || undefined}
        playsInline
        loop={!endSec}
        // Off-screen slides shouldn't pull their whole file down while you scroll.
        preload={active ? "auto" : "metadata"}
        className={cn("w-full", fill ? "h-full object-contain" : "aspect-[4/3] object-cover")}
        onLoadedMetadata={rewind}
        onTimeUpdate={onTimeUpdate}
        onClick={handleTap}
      />

      {hasMusic && <audio ref={audioRef} src={edit.musicUrl} loop preload="metadata" />}

      {/* Only shown on a deliberate pause — an idle overlay would sit on top of
          every clip in the scroller. */}
      {paused && active && (
        <button
          type="button"
          // Routed through the same handler so a double tap still likes while
          // the clip is paused, rather than only resuming it.
          onClick={handleTap}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center bg-black/20"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <Play className="ml-1 h-7 w-7" fill="currentColor" strokeWidth={0} aria-hidden />
          </span>
        </button>
      )}

      {edit.musicTitle && !fill && (
        <span className="pointer-events-none absolute bottom-3 left-3 flex min-w-0 max-w-[70%] items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white">
          <Music className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{edit.musicTitle}</span>
        </span>
      )}
    </div>
  );
}

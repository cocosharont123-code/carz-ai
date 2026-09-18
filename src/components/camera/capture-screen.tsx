"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, SwitchCamera, CameraOff } from "lucide-react";
import { useCamera, cameraSupported, recordingSupported, haptic } from "@/components/hooks/use-camera";
import { cn } from "@/lib/utils";

/** Longer than this and it is a hold, not a tap. */
const HOLD_MS = 300;
/** Matches MAX_CLIP_MS in the camera hook, for the ring's own arithmetic. */
const MAX_CLIP_MS = 15_000;

/**
 * The capture screen: a live viewfinder and two controls, nothing else.
 *
 * Tap the shutter for a still, hold it to record. A recording is handed back as
 * its first frame rather than as a clip — /api/identify takes one image, and
 * video scanning is a Carz MAX perk that was never built. Recording something
 * that cannot be scanned would be worse than not offering it, and a frame from
 * a moving car is often a better shot than a still taken one-handed.
 */
export function CaptureScreen({
  onPhoto,
  onPickFile,
  hint,
}: {
  /** A still, ready for the scan pipeline. */
  onPhoto: (file: File) => void;
  /** Open the system picker instead. */
  onPickFile: () => void;
  hint?: string;
}) {
  // Destructured rather than held as one object: the refs lint rule treats any
  // member access on a value containing a ref as a read during render.
  const {
    videoRef,
    status,
    facing,
    recording,
    start,
    flip,
    capturePhoto,
    startRecording,
    stopRecording,
  } = useCamera();
  const [flash, setFlash] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdTimer = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const heldRef = useRef(false);

  // Straight to the viewfinder. No tap-to-open step: on a page whose entire
  // purpose is photographing a car, the extra tap is pure ceremony.
  useEffect(() => {
    void start();
  }, [start]);

  useEffect(
    () => () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  async function shoot() {
    const file = await capturePhoto();
    if (!file) return;
    haptic(12);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    onPhoto(file);
  }

  function beginHold() {
    heldRef.current = false;
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      if (!recordingSupported()) return; // a hold where it cannot record is a tap
      if (!startRecording()) return;
      heldRef.current = true;
      haptic([8, 40, 8]);
      const startedAt = performance.now();
      const tick = () => {
        setProgress(Math.min(1, (performance.now() - startedAt) / MAX_CLIP_MS));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, HOLD_MS);
  }

  async function endHold() {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!heldRef.current) {
      await shoot(); // it was a tap after all
      return;
    }

    heldRef.current = false;
    setProgress(0);
    haptic(12);
    const clip = await stopRecording();
    if (!clip) return;
    const frame = await firstFrame(clip);
    if (frame) onPhoto(frame);
  }

  const blocked = status === "denied" || status === "unsupported";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* The viewfinder. object-cover so it fills the screen the way a camera
          app does rather than letterboxing onto black. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          status === "live" ? "opacity-100" : "opacity-0",
          facing === "user" && "scale-x-[-1]",
        )}
      />

      {/* Shutter flash. A white sheet at 180ms — long enough to register as a
          shutter, short enough not to hide the next frame. */}
      {flash && <div aria-hidden className="pointer-events-none absolute inset-0 bg-white" />}

      {blocked && <Blocked status={status} onRetry={() => void start()} onPickFile={onPickFile} />}

      {/* Controls. Nothing else sits over the picture. */}
      {!blocked && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 px-6"
          style={{ paddingBottom: "calc(var(--nav-h) + 0.5rem)" }}
        >
          <button
            type="button"
            onClick={onPickFile}
            className="press glass-bubble pointer-events-auto flex min-h-11 items-center gap-2 rounded-full px-4 text-[13px] font-bold"
          >
            <ImagePlus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Upload
          </button>

          <Shutter
            recording={recording}
            progress={progress}
            disabled={status !== "live"}
            onDown={beginHold}
            onUp={() => void endHold()}
          />

          <button
            type="button"
            onClick={flip}
            aria-label="Flip camera"
            className="press glass-bubble pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full"
          >
            <SwitchCamera className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}

      {hint && !blocked && (
        <p
          className="pointer-events-none absolute inset-x-0 text-center text-[13px] text-white/75 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
          style={{ bottom: "calc(var(--nav-h) + 5.5rem)" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * The button. Frosted glass with a specular rim, and a ring that fills while a
 * clip is being recorded.
 */
function Shutter({
  recording,
  progress,
  disabled,
  onDown,
  onUp,
}: {
  recording: boolean;
  progress: number;
  disabled: boolean;
  onDown: () => void;
  onUp: () => void;
}) {
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={recording ? "Stop recording" : "Take a photo"}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onPointerLeave={onUp}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "glass-bubble pointer-events-auto relative flex h-[76px] w-[76px] items-center justify-center rounded-full",
        "transition-transform duration-150 will-change-transform active:scale-90",
        "disabled:opacity-40",
        recording && "scale-105",
      )}
      style={{ WebkitTouchCallout: "none" }}
    >
      {/* Progress ring. Stroke-dashoffset on a rotated circle, which the
          compositor handles without laying anything out. */}
      {recording && (
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 76 76" aria-hidden>
          <circle
            cx="38"
            cy="38"
            r={R}
            fill="none"
            stroke="var(--color-neon-red)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
          />
        </svg>
      )}

      {/* The inner mark: a disc for a photo, a square while recording. */}
      <span
        className={cn(
          "bg-white transition-all duration-200",
          recording ? "h-6 w-6 rounded-[6px]" : "h-[58px] w-[58px] rounded-full",
        )}
      />
    </button>
  );
}

/** Camera refused or unavailable. */
function Blocked({
  status,
  onRetry,
  onPickFile,
}: {
  status: string;
  onRetry: () => void;
  onPickFile: () => void;
}) {
  const denied = status === "denied";
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6">
      <div className="glass-card w-full max-w-sm rounded-3xl p-6 text-center">
        <CameraOff className="mx-auto h-7 w-7 opacity-50" strokeWidth={1.5} aria-hidden />
        <h2 className="display mt-3 text-2xl">
          {denied ? "Camera is blocked" : "No camera here"}
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed opacity-70">
          {denied
            ? "Carz needs the camera to spot a car. Allow it in your browser's site settings for carz.dev, then try again."
            : "This browser won't give a live camera. You can still choose a photo from your library."}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {denied && cameraSupported() && (
            <button
              type="button"
              onClick={onRetry}
              className="press min-h-11 rounded-full bg-white text-sm font-bold text-black"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={onPickFile}
            className="press glass-card flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-bold"
          >
            <ImagePlus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Upload a photo
          </button>
        </div>

        {/* No "open settings" button: a web page cannot open iOS or Android
            settings, and a button that silently does nothing is worse than a
            sentence explaining where to go. */}
      </div>
    </div>
  );
}

/**
 * The first frame of a recorded clip, as a photo.
 *
 * Seeks a little way in rather than to zero — the opening frames of a handheld
 * recording are usually the blur of the phone still settling.
 */
async function firstFrame(clip: Blob): Promise<File | null> {
  const url = URL.createObjectURL(clip);
  try {
    const v = document.createElement("video");
    v.src = url;
    v.muted = true;
    v.playsInline = true;
    await new Promise<void>((resolve) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => resolve();
      window.setTimeout(resolve, 3000);
    });
    if (!v.videoWidth) return null;
    v.currentTime = Math.min(0.3, (v.duration || 1) / 2);
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
      window.setTimeout(resolve, 1500);
    });
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
    return blob ? new File([blob], `carz-${Date.now()}.jpg`, { type: "image/jpeg" }) : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

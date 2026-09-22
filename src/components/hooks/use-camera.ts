"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The live rear camera, and the two things anyone wants from it: a still, or a
 * short clip.
 *
 * One implementation. /hunt/spot already had a copy of the open-a-stream,
 * draw-to-canvas, stop-the-tracks dance, and a second copy on /spot would have
 * drifted from it the first time either was touched.
 *
 * Everything here is feature-detected rather than assumed. getUserMedia needs a
 * secure context and is absent inside some in-app browsers; MediaRecorder is
 * missing or codec-broken on parts of iOS. Both failures are reported as state
 * rather than thrown, because the page's answer to each is to offer the file
 * picker, not to show an error.
 */

export type CameraStatus = "idle" | "starting" | "live" | "denied" | "unsupported";

/** Longest clip a press-and-hold will record before stopping itself. */
const MAX_CLIP_MS = 15_000;

/**
 * How long to wait for the camera before giving up on it.
 *
 * getUserMedia does not always settle. A permission prompt that is never
 * answered leaves the promise pending forever, and the screen would sit on
 * "Opening camera…" with no way forward. After this it is treated as refused,
 * which is the state that offers Retry and Upload.
 */
const OPEN_TIMEOUT_MS = 12_000;

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

export function recordingSupported(): boolean {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";
}

/** A short buzz, where the platform has one. iOS Safari does not. */
export function haptic(ms: number | number[] = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* a device without a motor is not an error */
  }
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [recording, setRecording] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(
    async (which: "environment" | "user" = facing) => {
      if (!cameraSupported()) {
        setStatus("unsupported");
        return;
      }
      setStatus("starting");
      try {
        // `ideal`, not `exact`: a laptop has no environment camera, and an
        // exact constraint fails outright rather than falling back to the one
        // camera it does have.
        const ask = navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: which }, width: { ideal: 1920 } },
          audio: false,
        });
        const stream = await Promise.race([
          ask,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new DOMException("timeout", "NotAllowedError")),
              OPEN_TIMEOUT_MS,
            ),
          ),
        ]);
        // The race can resolve against a stream that arrives late; if it does,
        // its tracks would run with nothing showing them.
        ask.then((late) => {
          if (late !== stream) late.getTracks().forEach((t) => t.stop());
        }).catch(() => {});
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        setFacing(which);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // playsInline is on the element; without it iOS takes the video
          // fullscreen the moment it plays.
          await videoRef.current.play().catch(() => {});
        }
        setStatus("live");
      } catch (e) {
        // NotAllowedError is a refusal; everything else — no camera, camera in
        // use, insecure origin — is the same dead end from here.
        const denied = e instanceof DOMException && e.name === "NotAllowedError";
        setStatus(denied ? "denied" : "unsupported");
      }
    },
    [facing],
  );

  const flip = useCallback(() => {
    void start(facing === "environment" ? "user" : "environment");
  }, [facing, start]);

  /** A still from the live stream, at the sensor's own resolution. */
  const capturePhoto = useCallback(async (): Promise<File | null> => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // A front camera is mirrored on screen; a photo that does not match what
    // was on screen is a surprise, so the flip is baked in.
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/jpeg", 0.92),
    );
    if (!blob) return null;
    return new File([blob], `carz-${Date.now()}.jpg`, { type: "image/jpeg" });
  }, [facing]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !recordingSupported() || recorderRef.current) return false;
    try {
      const type = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
      // A hold that is never released — a finger that slid off, a call coming
      // in — would otherwise record until the tab closed.
      stopTimerRef.current = window.setTimeout(() => {
        recorderRef.current?.stop();
      }, MAX_CLIP_MS);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    const rec = recorderRef.current;
    if (!rec) return Promise.resolve(null);
    if (stopTimerRef.current !== null) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" })
          : null;
        chunksRef.current = [];
        recorderRef.current = null;
        setRecording(false);
        resolve(blob);
      };
      if (rec.state !== "inactive") rec.stop();
      else rec.onstop?.(new Event("stop"));
    });
  }, []);

  // Never leave the camera light on after this unmounts.
  useEffect(
    () => () => {
      if (stopTimerRef.current !== null) clearTimeout(stopTimerRef.current);
      recorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  return {
    videoRef,
    status,
    facing,
    recording,
    start,
    stop,
    flip,
    capturePhoto,
    startRecording,
    stopRecording,
  };
}

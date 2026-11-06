"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Pick the part of a photo that goes in the circle.
 *
 * Picking a photo used to centre-crop it and that was the whole of the choice:
 * a photo of two people became a photo of the gap between them, and a photo
 * where the face is anywhere but the middle became a photo of a shoulder. This
 * is the drag-and-pinch step in between.
 *
 * The viewport is a fixed 288px square -- small enough for a 320px Android and
 * large enough to see what is being framed, and fixed rather than measured so
 * the arithmetic below needs no ResizeObserver and no second render.
 *
 * §1: pan and zoom are one `transform` on the image and nothing else. The
 * element is laid out once, at the size that covers the viewport, and never
 * laid out again -- the slider moves a scale, not a width.
 */

/** The square we frame in, in CSS px. */
const S = 288;

/**
 * What comes out, in px. The avatar renders at 132, so this is enough for a 2x
 * screen with room over -- and still inside the 80kB the profile store allows.
 */
const OUT = 320;

const MIN_SCALE = 1;
const MAX_SCALE = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function AvatarCropper({
  src,
  onCancel,
  onDone,
}: {
  /** The photo as picked, full size. */
  src: string;
  onCancel: () => void;
  /** The square crop, as a JPEG data URL. */
  onDone: (dataUrl: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);

  /** Natural size, once the browser has decoded it. */
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [t, setT] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);

  /**
   * Cover at scale 1: the shorter side exactly fills the square, so the frame
   * can never show a gap however far it is dragged.
   */
  const k = nat ? S / Math.min(nat.w, nat.h) : 1;
  const baseW = nat ? nat.w * k : S;
  const baseH = nat ? nat.h * k : S;

  /**
   * How far off-centre the image may sit before an edge comes inside the frame.
   * Recomputed from the scale on every clamp rather than stored, because
   * zooming out has to pull a far-dragged photo back with it.
   */
  const limits = (s: number) => ({
    x: Math.max(0, (baseW * s - S) / 2),
    y: Math.max(0, (baseH * s - S) / 2),
  });

  const clampT = (p: { x: number; y: number }, s: number) => {
    const l = limits(s);
    return { x: clamp(p.x, -l.x, l.x), y: clamp(p.y, -l.y, l.y) };
  };

  const setScaleKeepingCentre = (next: number) => {
    const s = clamp(next, MIN_SCALE, MAX_SCALE);
    setScale(s);
    setT((p) => clampT(p, s));
  };

  // Hold the page still behind the sheet.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // --- Dragging and pinching ------------------------------------------------
  // Pointer events rather than mouse plus touch: one code path for a finger, a
  // trackpad and a mouse, and the second finger arrives as just another
  // pointer instead of a separate gesture API.

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    tx: number;
    ty: number;
    scale: number;
    cx: number;
    cy: number;
    dist: number;
  } | null>(null);

  const centroid = () => {
    const ps = [...pointers.current.values()];
    const x = ps.reduce((a, p) => a + p.x, 0) / ps.length;
    const y = ps.reduce((a, p) => a + p.y, 0) / ps.length;
    const dist =
      ps.length > 1 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0;
    return { x, y, dist };
  };

  // Re-read the gesture's starting point whenever a finger lands or lifts, so
  // going from one finger to two (and back) doesn't make the photo jump.
  const rebase = () => {
    if (pointers.current.size === 0) {
      gesture.current = null;
      return;
    }
    const c = centroid();
    gesture.current = { tx: t.x, ty: t.y, scale, cx: c.x, cy: c.y, dist: c.dist };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Captured on the frame, not on whatever was under the finger, so a drag
    // that leaves the square keeps arriving here.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    rebase();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const g = gesture.current;
    const c = centroid();

    // Two fingers: the distance between them is the zoom, and the point between
    // them is still the grab handle, so a pinch can move the photo as well.
    let s = g.scale;
    if (pointers.current.size > 1 && g.dist > 0) {
      s = clamp((g.scale * c.dist) / g.dist, MIN_SCALE, MAX_SCALE);
      setScale(s);
    }

    setT(clampT({ x: g.tx + (c.x - g.cx), y: g.ty + (c.y - g.cy) }, s));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    rebase();
  };

  /**
   * Wheel and trackpad zoom, attached by hand.
   *
   * React registers `wheel` on its root as passive, so an onWheel prop cannot
   * call preventDefault -- it would only log the attempt and then let the page
   * scroll anyway. A native listener with passive:false can.
   */
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScaleKeepingCentre(scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // Re-attached when the scale or the fitted size changes, because the
    // handler clamps against both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, baseW, baseH]);

  // --- Writing it out -------------------------------------------------------

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !nat || busy) return;
    setBusy(true);

    /**
     * The frame, converted back into the photo's own pixels.
     *
     * The frame spans S px around the image's centre, offset by the drag, at
     * k * scale px of frame per px of photo -- so dividing gives the source
     * square. The clamp above is what guarantees it lands inside the photo.
     */
    const per = k * scale;
    const side = S / per;
    const sx = nat.w / 2 + (-S / 2 - t.x) / per;
    const sy = nat.h / 2 + (-S / 2 - t.y) / per;

    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      onCancel();
      return;
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, OUT, OUT);

    // The profile store caps a picture at 80kB, so a photo that encodes large
    // gets one more pass at a smaller size rather than a rejected save.
    let out = canvas.toDataURL("image/jpeg", 0.8);
    if (out.length > 78_000) {
      const small = document.createElement("canvas");
      small.width = 256;
      small.height = 256;
      const sctx = small.getContext("2d");
      if (sctx) {
        sctx.imageSmoothingQuality = "high";
        sctx.drawImage(canvas, 0, 0, 256, 256);
        out = small.toDataURL("image/jpeg", 0.68);
      }
    }
    onDone(out);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Position your photo"
      // Opaque: a translucent full-screen layer over a page made of glass
      // recomposites the whole document every frame, and it covers everything
      // anyway, so there is nothing to see through it.
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-background px-5"
    >
      <p className="text-center text-[15px] opacity-60">Drag to move · pinch or zoom to fill</p>

      <div
        // touch-action: none, or the browser pans the page instead of the photo.
        ref={frameRef}
        className="relative shrink-0 touch-none overflow-hidden rounded-[28%] bg-black/40"
        style={{ width: S, height: S }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const el = e.currentTarget;
            setNat({ w: el.naturalWidth, h: el.naturalHeight });
            setScale(1);
            setT({ x: 0, y: 0 });
          }}
          // Laid out once, at cover size and centred in the frame by position.
          // Everything after that is the transform and nothing else -- §9 bans
          // a permanent will-change, and an <img> composites off its transform
          // without being promised one.
          style={{
            width: baseW,
            height: baseH,
            left: (S - baseW) / 2,
            top: (S - baseH) / 2,
            transform: `translate3d(${t.x}px, ${t.y}px, 0) scale(${scale})`,
          }}
          className="absolute origin-center select-none"
        />

        {/* The circle, cut out of a dim sheet: a ring alone would say where the
            edge is but not that the corners are going to be thrown away. The
            radius is the frame's own, so what is inside the ring is exactly
            what the avatar will show. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border border-white/70"
        />
      </div>

      {/* Zoom for everyone who is not using two fingers: a trackpad, a mouse, a
          keyboard, or one hand on a phone. */}
      <div className="flex w-full max-w-[288px] items-center gap-3">
        <button
          type="button"
          onClick={() => setScaleKeepingCentre(scale - 0.25)}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
          className="press glass-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
        >
          <Minus className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
        </button>

        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={scale}
          aria-label="Zoom"
          onChange={(e) => setScaleKeepingCentre(Number(e.target.value))}
          className="h-11 min-w-0 flex-1 accent-carz"
        />

        <button
          type="button"
          onClick={() => setScaleKeepingCentre(scale + 0.25)}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
          className="press glass-chip flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-30"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      <div className="flex w-full max-w-[288px] items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="press glass-card h-12 flex-1 rounded-card text-[15px] font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!nat || busy}
          className="press h-12 flex-1 rounded-card bg-carz text-[15px] font-semibold text-carz-ink disabled:opacity-40"
        >
          Use photo
        </button>
      </div>
    </div>
  );
}

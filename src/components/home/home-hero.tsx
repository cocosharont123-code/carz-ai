"use client";

import Image from "next/image";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { DEFAULT_HERO } from "@/config/home";
import { HeroPicker } from "@/components/home/hero-picker";

/**
 * The Home hero: a photo, a gradient down to solid black, and the headline.
 *
 * `initialPhoto` is read on the server from the signed-in profile and handed
 * down, so the chosen photo is in the first painted frame. Fetching it after
 * mount would show the default and then swap, which is the flash the brief
 * asked to avoid.
 *
 * The gradient is fixed rather than tuned per photo: the headline has to stay
 * readable over whatever anyone puts back there, so the bottom of the frame is
 * solid #000 regardless of the image.
 */
export function HomeHero({
  initialPhoto,
  canCustomize,
}: {
  /** Base64 thumbnail from the profile, or "" for the default. */
  initialPhoto: string;
  /** Signed in with a profile to save to. */
  canCustomize: boolean;
}) {
  const [photo, setPhoto] = useState(initialPhoto);
  // Live preview while the sheet is open, without committing anything.
  const [preview, setPreview] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const shown = preview ?? photo;
  // The default asset may not be in /public yet; #0a0a0a stands in for it, and
  // also catches a stored photo that will not load.
  const src = failed ? "" : shown || DEFAULT_HERO;

  return (
    <section className="relative -mx-5 h-[45vh] min-h-[320px] w-[calc(100%+40px)] overflow-hidden bg-[#0a0a0a]">
      {src && (
        <Image
          src={src}
          alt=""
          fill
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          className="object-cover object-center"
          // A data: URL is already a thumbnail — Next's optimiser has nothing
          // to do with it and cannot fetch it anyway.
          unoptimized={src.startsWith("data:")}
          onError={() => setFailed(true)}
        />
      )}

      {/* Two stops, two jobs: a little darkening at the top so the wordmark and
          the avatar read against a bright photo, then a fade to solid black so
          the headline below always has a flat ground. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,.45) 0%, rgba(0,0,0,.05) 28%, rgba(0,0,0,.55) 62%, #000 100%)",
        }}
      />

      <div className="absolute inset-x-5 bottom-5">
        <h1 className="text-[36px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em]">
          <span className="block text-white">Snap</span>
          <span className="block text-white">any car.</span>
          <span className="block text-white/60">Know</span>
          <span className="block text-white/60">everything.</span>
        </h1>
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-white/60">
          Specs · Prices · Performance
        </p>
      </div>

      {canCustomize && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press absolute bottom-5 right-5 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 text-[12px] font-semibold text-white backdrop-blur-md"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Customize
        </button>
      )}

      {open && (
        <HeroPicker
          current={photo}
          onPreview={setPreview}
          onClose={() => {
            setPreview(null);
            setOpen(false);
          }}
          onSaved={(next) => {
            setPhoto(next);
            setPreview(null);
            setFailed(false);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

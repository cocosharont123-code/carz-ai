"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { User, Sparkles, X, Check } from "lucide-react";
import { getGarage, type GarageCar } from "@/lib/garage-local";
import { cn } from "@/lib/utils";

/**
 * The home hero: photo, wordmark, headline, and the picker that changes it.
 *
 * Seeded from the server with the viewer's saved photo, so the first paint is
 * already the right image and the default never flashes. It is a client
 * component only because the picker previews a photo live behind its own
 * sheet, which needs state.
 *
 * The garage is read here rather than passed in: it lives in localStorage on
 * this device, so the server has nothing to send.
 */

/** Added by the user; until then the hero is flat #0a0a0a and still readable. */
const DEFAULT_HERO = "/home-hero-default.jpg";

export function HomeHero({
  initialPhoto,
  signedIn,
}: {
  /** The saved photo, server-rendered. "" means use the default. */
  initialPhoto: string;
  signedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialPhoto);
  const [preview, setPreview] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  // What is on screen: the preview while picking, otherwise what is saved.
  const photo = preview ?? saved;
  const usingCustom = !!photo && !failed;

  return (
    <section className="relative -mx-5 h-[45vh] min-h-[320px] overflow-hidden bg-[#0a0a0a]">
      {usingCustom ? (
        <Image
          key={photo}
          src={photo}
          alt=""
          fill
          priority
          // A saved photo is a base64 thumbnail from the garage. The image
          // optimiser cannot process a data URL, and there is nothing to gain
          // from it at 360px anyway.
          unoptimized
          className="object-cover object-center"
          onError={() => setFailed(true)}
        />
      ) : (
        <Image
          src={DEFAULT_HERO}
          alt=""
          fill
          priority
          className="object-cover object-center"
          // Missing until the asset is added, and a broken-image frame is worse
          // than the flat near-black underneath it.
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      )}

      {/* Two overlays, not one. The top is a short scrim so the wordmark and the
          profile button read against a bright photo; the bottom runs all the way
          to solid #000 so the headline sits on black and the section joins the
          page with no seam. */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-black/55 to-black" />

      <header className="absolute inset-x-0 top-0 flex items-start justify-between px-5 pt-4">
        <span className="text-[40px] font-black lowercase leading-none tracking-[-0.03em] text-white">
          carz
        </span>
        <Link
          href="/profile"
          aria-label="Your profile"
          className="press flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/[0.06] backdrop-blur-md"
        >
          <User className="h-[18px] w-[18px] text-white" strokeWidth={1.75} aria-hidden />
        </Link>
      </header>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
        <h1 className="text-[36px] font-extrabold uppercase leading-[0.95] tracking-[-0.02em]">
          <span className="block text-white">Snap</span>
          <span className="block text-white">Any car.</span>
          <span className="block text-white/60">Know</span>
          <span className="block text-white/60">Everything.</span>
        </h1>
        <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-white/60">
          Specs · Prices · Performance
        </p>
      </div>

      {/* Signed-out viewers have no garage on the server and nothing to pick
          from, so the control is not drawn rather than drawn and refused. */}
      {signedIn && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press absolute bottom-5 right-5 flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.08] px-3 text-[12px] font-semibold text-white backdrop-blur-md"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Customize
        </button>
      )}

      {open && (
        <HeroPicker
          current={saved}
          onPreview={setPreview}
          onClose={() => {
            setPreview(null);
            setOpen(false);
          }}
          onSaved={(next) => {
            setSaved(next);
            setPreview(null);
            setFailed(false);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

/**
 * The picker sheet: the garage as a grid, plus a Default tile.
 *
 * Fixed to the viewport rather than inside the hero, so it is a sheet over the
 * page rather than a panel clipped by a 45vh box -- and the hero stays visible
 * above it, which is the point of previewing.
 */
function HeroPicker({
  current,
  onPreview,
  onClose,
  onSaved,
}: {
  current: string;
  onPreview: (photo: string | null) => void;
  onClose: () => void;
  onSaved: (photo: string) => void;
}) {
  const [cars, setCars] = useState<GarageCar[] | null>(null);
  const [picked, setPicked] = useState<string>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Deferred a microtask: localStorage is the external system being read, and
    // a synchronous state write in an effect body cascades renders.
    Promise.resolve()
      .then(() => getGarage())
      .then((g) => {
        if (!cancelled) setCars(g.filter((c) => !!c.image));
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function choose(photo: string) {
    setPicked(photo);
    // "" is the default tile, which previews as no custom photo at all.
    onPreview(photo === "" ? "" : photo);
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/home-hero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: picked === "" ? null : picked }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) {
        setError(d?.error || "Couldn't save that.");
        return;
      }
      onSaved(picked);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a home background"
      className="fixed inset-0 z-[70] flex items-end justify-center"
    >
      {/* The scrim stops short of the top so the hero stays visible while you
          pick, which is what makes the live preview worth having. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 top-[42vh] bg-black/60"
      />

      <div className="glass-card relative w-full max-w-[480px] rounded-t-sheet rounded-b-none border-x-0 border-b-0 px-5 pb-6 pt-3">
        <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-foreground/25" />

        <div className="mt-3 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold text-foreground">Home background</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="press flex h-9 w-9 items-center justify-center rounded-full"
          >
            <X className="h-5 w-5 text-foreground" strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {cars === null ? (
          <p className="mt-4 text-[14px] text-[var(--color-secondary-text)]">Loading your garage…</p>
        ) : (
          <div className="mt-4 grid max-h-[32vh] grid-cols-3 gap-2 overflow-y-auto">
            <Tile
              label="Default"
              selected={picked === ""}
              onClick={() => choose("")}
            />
            {cars.map((c) => (
              <Tile
                key={c.id}
                photo={c.image}
                label={`${c.make} ${c.model}`}
                selected={picked === c.image}
                onClick={() => choose(c.image)}
              />
            ))}
          </div>
        )}

        {cars?.length === 0 && (
          <p className="mt-3 text-[14px] text-[var(--color-secondary-text)]">
            Your garage is empty. Save a car from a scan and it can go here.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[14px] text-error">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => choose("")}
            className="press glass-card h-[52px] flex-1 rounded-full border-[var(--line-button)] text-[15px] font-semibold"
          >
            Reset to default
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="press h-[52px] flex-1 rounded-full bg-carz text-[15px] font-semibold text-carz-ink disabled:opacity-50"
          >
            {busy ? "Saving…" : "Use this photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({
  photo,
  label,
  selected,
  onClick,
}: {
  photo?: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        "press relative aspect-square overflow-hidden rounded-thumb border",
        selected ? "border-foreground" : "border-[var(--line-card)]",
      )}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-foreground/[0.06] text-[12px] font-semibold text-foreground">
          Default
        </span>
      )}
      {selected && (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-carz">
          <Check className="h-3 w-3 text-carz-ink" strokeWidth={3} aria-hidden />
        </span>
      )}
    </button>
  );
}

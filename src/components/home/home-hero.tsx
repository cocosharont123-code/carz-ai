"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const photo = saved;
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

      {/* No wordmark. It sat directly over the headline and the headline is the
          thing to read. justify-end keeps the profile button where it was. */}
      <header className="absolute inset-x-0 top-0 flex items-start justify-end px-5 pt-4">
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
          onClose={() => setOpen(false)}
          onSaved={(next) => {
            setSaved(next);
            setFailed(false);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

/**
 * The picker: centred in front of you, with its own preview.
 *
 * It was a bottom sheet whose scrim deliberately stopped partway up so the hero
 * showed through and could be previewed live. Three things came out of that.
 * The panel sat at the bottom of the screen instead of in front of you. The
 * uncovered strip left the page behind scrollable and tappable, which is the
 * stray scrolling. And relying on seeing behind the sheet meant the panel had
 * to stay short, so a garage of any size became a cramped scrolling grid.
 *
 * Centred, with a full scrim, and the preview moved inside: the strip at the
 * top shows exactly what the hero will look like, at the hero's own aspect, so
 * nothing needs to be visible behind the dialog at all.
 *
 * Rendered through a portal to <body>. A fixed element is positioned against
 * the viewport only while no ancestor has a transform, filter or containment on
 * it; the portal puts it where none of that can reach, rather than depending on
 * the ancestors staying that way.
 */
function HeroPicker({
  current,
  onClose,
  onSaved,
}: {
  current: string;
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
        if (!cancelled) setCars(g.filter((c) => !!c.image).sort((a, b) => b.ts - a.ts));
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Nothing behind this scrolls while it is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  // No mounted guard: this only renders after the Customize button is pressed,
  // so it cannot run during the server render and document always exists here.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose a home background"
      className="fixed inset-0 z-[90] flex items-center justify-center p-5"
      // iOS keeps scrolling the page under a modal even with body overflow
      // hidden, so the drag is refused here as well.
      onTouchMove={(e) => e.preventDefault()}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/80" />

      <div className="glass-card relative flex max-h-[86dvh] w-full max-w-[22rem] flex-col rounded-sheet p-4">
        <div className="flex items-center justify-between">
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

        {/* The preview, at the hero's own shape. This is what the sheet used to
            rely on seeing behind itself for. */}
        <div className="mt-3 aspect-[16/9] w-full overflow-hidden rounded-thumb bg-[#0a0a0a]">
          {picked ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picked} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[13px] text-[var(--color-secondary-text)]">
              Default background
            </span>
          )}
        </div>

        {cars === null ? (
          <p className="mt-4 text-[14px] text-[var(--color-secondary-text)]">Loading your garage…</p>
        ) : cars.length === 0 ? (
          <p className="mt-4 text-[14px] text-[var(--color-secondary-text)]">
            Your garage is empty. Save a car from a scan and it can go here.
          </p>
        ) : (
          // min-h-0 so this scrolls inside the dialog instead of growing it: a
          // flex child defaults to min-height:auto and would push the buttons
          // off the bottom once the garage had more than a row or two.
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Default" selected={picked === ""} onClick={() => setPicked("")} />
              {cars.map((c) => (
                <Tile
                  key={c.id}
                  photo={c.image}
                  label={`${c.make} ${c.model}`}
                  selected={picked === c.image}
                  onClick={() => setPicked(c.image)}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[14px] text-error">
            {error}
          </p>
        )}

        <div className="mt-4 flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => setPicked("")}
            className="press glass-card h-[52px] flex-1 rounded-full border-[var(--line-button)] text-[15px] font-semibold"
          >
            Reset
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
    </div>,
    document.body,
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

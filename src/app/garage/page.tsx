"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Trash2, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { PageTabs } from "@/components/page-tabs";
import { MemberGate } from "@/components/member-gate";
import { getGarage, removeFromGarage, clearGarage, type GarageCar } from "@/lib/garage-local";
import { Button, PageMasthead, StatRow, CarPhoto, Skeleton } from "@/components/ui/editorial";

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function GaragePage() {
  return (
    <MemberGate
      tabs={<PageTabs group="collection" />}
      title="Garage"
      blurb="A photo album of every car you've saved."
      points={[
        "Save a car from a scan and it lands here as a photo.",
        "Tracks your total saves, unique models, and rarest find.",
        "Browse the album full-screen, one car at a time.",
      ]}
    >
      <GarageInner />
    </MemberGate>
  );
}

/**
 * Full-screen viewer for one saved car. The album is the point of the page, so
 * a tap opens the photo big rather than navigating away from the grid.
 */
function Lightbox({
  cars,
  index,
  onClose,
  onMove,
  onRemove,
}: {
  cars: GarageCar[];
  index: number;
  onClose: () => void;
  onMove: (next: number) => void;
  onRemove: (id: string) => void;
}) {
  const car = cars[index];

  // Keyboard is the natural way through an album on a desktop, and Escape is
  // the expected way out of anything full-screen.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < cars.length - 1) onMove(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onMove(index - 1);
    },
    [cars.length, index, onClose, onMove],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  // Hold the page still behind the viewer.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!car) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${car.make} ${car.model}`}
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4">
        <span className="util-label text-white/60">
          {index + 1} / {cars.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Stop the backdrop's close handler firing on the photo itself. */}
      <div
        className="flex flex-1 items-center justify-center px-4"
        onClick={(e) => e.stopPropagation()}
      >
        <CarPhoto
          src={car.image}
          alt={`${car.make} ${car.model}`}
          color
          className="max-h-full max-w-full rounded-2xl object-contain"
        />
      </div>

      <div className="p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex w-full max-w-lg items-center gap-3">
          <button
            type="button"
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
            aria-label="Previous"
            className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-25"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1 text-center text-white">
            <p className="truncate text-sm font-bold">
              {car.make} {car.model}
            </p>
            <p className="util-label mt-0.5 truncate text-white/50">
              {car.yearRange}
              {car.priceRange ? ` · ${car.priceRange}` : ""} · {fmtDate(car.ts)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onMove(index + 1)}
            disabled={index === cars.length - 1}
            aria-label="Next"
            className="press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-25"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => onRemove(car.id)}
            className="press inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-white/20"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove from garage
          </button>
        </div>
      </div>
    </div>
  );
}

function GarageInner() {
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState<GarageCar[]>([]);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    // Written in a callback, not the effect body — localStorage is the external
    // system this is syncing from.
    Promise.resolve(getGarage())
      .then(setCars)
      .finally(() => setLoading(false));
  }, []);

  function remove(id: string) {
    const next = removeFromGarage(id);
    setCars(next);
    // Removing from inside the viewer: stay on the same slot, or step back if
    // the last car went, or close if the album is now empty.
    setOpen((i) => (i === null ? null : next.length === 0 ? null : Math.min(i, next.length - 1)));
  }

  function clearAll() {
    if (window.confirm("Clear your entire garage? This can't be undone.")) {
      clearGarage();
      setCars([]);
      setOpen(null);
    }
  }

  const uniqueModels = new Set(cars.map((c) => `${c.make} ${c.model}`.trim())).size;
  const rarest = cars.reduce<GarageCar | null>(
    (best, c) => (!best || c.rarityScore > best.rarityScore ? c : best),
    null,
  );

  return (
    <>
      <PageTabs group="collection" />
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <PageMasthead
          eyebrow="Your album · members only"
          title="Garage"
          count={loading ? "—" : `${cars.length} saved`}
          action={
            cars.length > 0 ? (
              <button onClick={clearAll} className="util-label">
                Clear all
              </button>
            ) : null
          }
        />

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : cars.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-10 text-center">
            <Images className="mx-auto h-8 w-8 opacity-40" strokeWidth={1.5} aria-hidden />
            <h3 className="display mt-3 text-3xl">Album empty</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm opacity-70">
              Nothing saved yet. Identify a car and press{" "}
              <span className="font-semibold">Save to garage</span> to add it here.
            </p>
            <Button href="/spot" className="mt-6">
              Spot a car
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-4">
              <StatRow value={cars.length} label="Saved" className="p-4 sm:p-6" />
              <StatRow value={uniqueModels} label="Unique models" yellow className="p-4 sm:p-6" />
              <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-card text-card-foreground p-4 sm:p-6">
                <div className="display truncate text-2xl sm:text-3xl">
                  {rarest && rarest.rarityScore > 0 ? `${rarest.make} ${rarest.model}` : "—"}
                </div>
                <div className="util-label mt-2">Rarest find</div>
              </div>
            </div>

            {/* The album: photos edge to edge, captions on the tile rather than
                in a card below it, so the page reads as pictures first. */}
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {cars.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpen(i)}
                  aria-label={`Open ${c.make} ${c.model}`}
                  className="press group relative aspect-square overflow-hidden rounded-xl bg-white/[0.04]"
                >
                  <CarPhoto
                    src={c.image}
                    alt={`${c.make} ${c.model}`}
                    color
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  />

                  {c.rarityScore >= 70 && (
                    <span className="util-label absolute left-2 top-2 rounded-md bg-carz px-1.5 py-0.5">
                      Rare
                    </span>
                  )}

                  {/* Caption rides on the photo behind a scrim, so a white car
                      can't wash the text out. */}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 text-left">
                    <span className="block truncate text-[12px] font-bold text-white">
                      {c.make} {c.model}
                    </span>
                    <span className="block truncate text-[10px] text-white/60">{c.yearRange}</span>
                  </span>
                </button>
              ))}
            </div>

            <p className="util-label mt-6 text-center">Saved on this device only — not uploaded.</p>
          </>
        )}
      </main>

      {open !== null && cars[open] && (
        <Lightbox
          cars={cars}
          index={open}
          onClose={() => setOpen(null)}
          onMove={(next) => setOpen(Math.max(0, Math.min(cars.length - 1, next)))}
          onRemove={remove}
        />
      )}
    </>
  );
}

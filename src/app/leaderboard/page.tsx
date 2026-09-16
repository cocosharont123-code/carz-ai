"use client";

import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/default-avatar";
import { Button, PageMasthead, CarPhoto, Skeleton, Eyebrow } from "@/components/ui/editorial";
import { cn } from "@/lib/utils";

type RareCar = {
  id: string;
  make: string;
  model: string;
  yearRange: string;
  rarityScore: number;
  rarityReason?: string;
  priceRange?: string;
  image?: string;
  spotter: string;
  spotterImage?: string;
  spotterMember?: boolean; // spotter is a current Carz+ member
  ts: number;
};

function rarityLabel(s: number): string {
  return s >= 100 ? "Ultra rare" : s >= 85 ? "Extremely rare" : s >= 70 ? "Rare" : s >= 45 ? "Uncommon" : "Common";
}

export default function LeaderboardPage() {
  const [open, setOpen] = useState<RareCar | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [cars, setCars] = useState<RareCar[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured !== false);
        setCars(Array.isArray(d.cars) ? d.cars : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <PageMasthead eyebrow="The board" title="Rarest Cars" count={loading ? "—" : `${cars.length} logged`} />

        {loading ? (
          <div className="mt-6 space-y-px">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !configured ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-8 text-center">
            <Eyebrow yellow className="justify-center">Warming up</Eyebrow>
            <p className="mt-2 text-sm ">The board is connecting its database. Check back in a moment.</p>
          </div>
        ) : cars.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-card text-card-foreground p-10 text-center">
            <h3 className="display text-3xl">No cars yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm ">
              The board is empty. Spot a rare car and claim the top slot.
            </p>
            <Button href="/spot" className="mt-6">Spot a car</Button>
          </div>
        ) : (
          <div className="reveal mt-6 overflow-hidden rounded-2xl border border-white/10">
            {/* header */}
            <div className="hidden grid-cols-[3rem_5rem_1fr_5rem] items-center gap-3 border-b border-white/15 px-4 py-2.5 sm:grid">
              <span className="util-label ">#</span>
              <span className="util-label ">Car</span>
              <span className="util-label ">Spotter</span>
              <span className="util-label text-right ">Rarity</span>
            </div>
            {cars.map((c, i) => {
              // Only the top three are highlighted. This used to key off
              // rarity >= 100, which lit any ultra-rare car wherever it sat in
              // the list — including well down the board, where a highlighted
              // row reads as the leader and isn't one.
              const top = i < 3;
              return (
                <div
                  key={c.id}
                  className={cn(
                    "group grid grid-cols-[2.5rem_4rem_1fr_auto] items-center gap-3 border-b border-white/10 px-4 sm:grid-cols-[3rem_5rem_1fr_5rem]",
                    top ? "bg-carz/10" : "",
                    top ? "py-4" : "py-3",
                  )}
                >
                  <span className={cn("display", top ? "text-3xl" : "text-2xl")}>
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(c)}
                    aria-label={`See ${c.make} ${c.model} and its rarity`}
                    className={cn(
                      "press overflow-hidden rounded-lg transition-transform hover:scale-105",
                      top ? "h-14 w-16" : "h-12 w-14",
                    )}
                  >
                    <CarPhoto src={c.image} alt={`${c.make} ${c.model}`} className="h-full w-full" color />
                  </button>
                  <div className="min-w-0">
                    <p className={cn("truncate font-semibold", top && "text-lg")}>
                      {c.make} {c.model}
                      {c.yearRange ? <span className="font-normal"> · {c.yearRange}</span> : null}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs">
                      <Avatar src={c.spotterImage} size={15} />
                      <span className="truncate">{c.spotter}</span>
                      {/* A crown rather than a "Carz+" pill. The label still has
                          to reach a screen reader and a hover, so it moves to the
                          wrapper — an icon on its own says nothing to either.
                          text-rank-1 is the gold this board already uses for
                          first place. */}
                      {c.spotterMember && (
                        <span
                          role="img"
                          aria-label="Carz+ member"
                          title="Carz+ member"
                          className="inline-flex shrink-0 items-center"
                        >
                          <Crown
                            className="h-3.5 w-3.5 text-rank-1 drop-shadow-[0_0_6px_rgba(250,204,21,0.45)]"
                            strokeWidth={2}
                            fill="currentColor"
                            aria-hidden
                          />
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={cn("display", top ? "text-3xl" : "text-2xl")}>{Math.round(c.rarityScore)}</div>
                    <div className="util-label">{rarityLabel(c.rarityScore)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {open && <CarViewer car={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/**
 * One car, big, with what made it rare underneath.
 *
 * The board can only afford a thumbnail per row, which is too small to see the
 * car that earned the score beside it. Tapping one opens it at a size worth
 * looking at, and puts the meter directly under the photo so the number and the
 * thing it is about are read together.
 */
function CarViewer({ car, onClose }: { car: RareCar; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const raw = Math.max(0, Math.round(car.rarityScore));
  const ultra = raw >= 100;
  const fill = Math.min(100, raw);

  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${car.make} ${car.model}`}
        className="nav-sheet-in fixed inset-x-0 bottom-0 z-[80] mx-auto w-full max-w-sm px-4 pb-8"
        style={{ bottom: "calc(var(--nav-h) + 0.5rem)" }}
      >
        <div className="glass-bubble rounded-[32px] p-4">
          {/* The squircle. A radius this large against the photo's own size is
              what reads as a continuous corner rather than a rounded box. */}
          <div className="aspect-square w-full overflow-hidden rounded-[26%]">
            <CarPhoto src={car.image} alt={`${car.make} ${car.model}`} className="h-full w-full" color />
          </div>

          <p className="mt-4 truncate text-center text-lg font-bold">
            {car.make} {car.model}
          </p>
          {car.yearRange && (
            <p className="mt-0.5 text-center text-[13px] opacity-60">{car.yearRange}</p>
          )}

          {/* The meter, directly under the photo. */}
          <div
            className={cn(
              "mt-4 rounded-2xl p-3.5",
              ultra
                ? "bg-gradient-to-r from-neon-red/20 via-neon-green/12 to-neon-blue/20"
                : "bg-white/[0.06]",
            )}
          >
            <div className="flex items-baseline justify-between">
              <span className="util-label opacity-70">Rarity</span>
              <span className="text-sm font-bold">
                {raw}/100 · <span className="text-neon-red">{rarityLabel(raw)}</span>
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-black/40">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  ultra
                    ? "bg-gradient-to-r from-neon-red via-neon-green to-neon-blue"
                    : "bg-carz",
                )}
                style={{ width: `${fill}%` }}
              />
            </div>
            {car.rarityReason && (
              <p className="mt-2.5 text-[13px] leading-relaxed opacity-75">{car.rarityReason}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="press mt-4 min-h-11 w-full rounded-full bg-white text-sm font-bold text-black"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

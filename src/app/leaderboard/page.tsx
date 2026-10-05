"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Crown, MapPin } from "lucide-react";
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
  /** The scan that also dropped this car's map pin, when the spotter shared one. */
  scanId?: string;
};

function rarityLabel(s: number): string {
  return s >= 100 ? "Ultra rare" : s >= 85 ? "Extremely rare" : s >= 70 ? "Rare" : s >= 45 ? "Uncommon" : "Common";
}

function LeaderboardInner() {
  const params = useSearchParams();
  /** Set when a map pin sent someone here to see one particular car. */
  const wanted = params.get("car");

  const [open, setOpen] = useState<RareCar | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [cars, setCars] = useState<RareCar[]>([]);
  /** scanId -> spot id, for the cars whose pin is still on the map. */
  const [pins, setPins] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setConfigured(d.configured !== false);
        const list: RareCar[] = Array.isArray(d.cars) ? d.cars : [];
        setCars(list);
        // Arriving from a pin opens that car straight away, rather than landing
        // someone on a list and making them find the row they just tapped.
        if (wanted) {
          const match = list.find((c) => c.id === wanted);
          if (match) setOpen(match);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [wanted]);

  /**
   * Which of these cars still have a live pin.
   *
   * Spots expire after a day, so this is deliberately read fresh rather than
   * inferred from the entry: a board entry is permanent and its pin is not, and
   * offering the map for a pin that has aged out would be a link to nothing.
   */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/spots", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list: { id: string; scanId?: string }[] = Array.isArray(d.spots) ? d.spots : [];
        const map = new Map<string, string>();
        for (const sp of list) if (sp.scanId) map.set(sp.scanId, sp.id);
        setPins(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
          <div className="mt-8 rounded-card glass-card p-8 text-center">
            <Eyebrow yellow className="justify-center">Warming up</Eyebrow>
            <p className="mt-2 text-sm ">The board is connecting its database. Check back in a moment.</p>
          </div>
        ) : cars.length === 0 ? (
          <div className="mt-8 rounded-card glass-card p-10 text-center">
            <h3 className="display text-3xl">No cars yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm ">
              The board is empty. Spot a rare car and claim the top slot.
            </p>
            <Button href="/spot" className="mt-6">Spot a car</Button>
          </div>
        ) : (
          <div className="reveal mt-6 overflow-hidden rounded-card border border-[var(--line-card)]">
            {/* header */}
            <div className="hidden grid-cols-[3rem_5rem_1fr_5rem] items-center gap-3 border-b border-[var(--line-card)] px-4 py-2.5 sm:grid">
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
                    "group grid grid-cols-[2.5rem_4rem_1fr_auto] items-center gap-3 border-b border-[var(--line-card)] px-4 sm:grid-cols-[3rem_5rem_1fr_5rem]",
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
                            className="h-3.5 w-3.5 text-rank-1 drop-shadow-[0_0_6px_rgba(255,255,255,0.45)]"
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

      {open && (
        <CarViewer
          car={open}
          spotId={open.scanId ? pins.get(open.scanId) : undefined}
          onClose={() => setOpen(null)}
        />
      )}
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
function CarViewer({
  car,
  spotId,
  onClose,
}: {
  car: RareCar;
  /** The live pin for this car, when one is still on the map. */
  spotId?: string;
  onClose: () => void;
}) {
  // The photo's own pixel width, read off the element once it decodes, so it
  // is never displayed larger than it actually is.
  const [natural, setNatural] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Nothing behind this scrolls while it is open. Without it the board is
  // still scrollable under the backdrop, which on a phone reads as the viewer
  // itself sliding around.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const raw = Math.max(0, Math.round(car.rarityScore));
  const ultra = raw >= 100;
  const fill = Math.min(100, raw);

  return (
    <>
      <div onClick={onClose} aria-hidden className="fixed inset-0 z-[75] bg-background/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${car.make} ${car.model}`}
        // touch-none as well as the body lock: on iOS, body { overflow: hidden }
        // does not actually stop a drag, so without this the board still moves
        // underneath and the viewer reads as sliding about.
        onTouchMove={(e) => e.preventDefault()}
        className="fixed inset-0 z-[80] flex touch-none items-center justify-center overscroll-none px-5"
      >
        {/* Centred in the viewport and never scrollable. Nothing here has a
            height ceiling of its own: the photo is capped at half the viewport
            and everything under it is a fixed few lines, so the card is always
            shorter than the screen and has nothing to scroll. */}
        <div className="nav-sheet-in glass-bubble w-full max-w-[22rem] overflow-hidden rounded-[32px] p-4">
          {/* The whole car, never enlarged past its own resolution.
              
              The image sizes the box rather than the other way round: given
              max-width and height:auto it lays out at its own aspect ratio the
              moment it decodes, so there is no square placeholder snapping to
              the real shape a frame later. The cap is the file's own pixel
              width — the board stores a thumbnail, and blowing one up is
              exactly what made it look pixelated. Small photos render small and
              sharp rather than large and soft. */}
          <div className="flex items-center justify-center overflow-hidden rounded-[26%] bg-background/30">
            {car.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={car.image}
                alt={`${car.make} ${car.model}`}
                onLoad={(e) => setNatural(e.currentTarget.naturalWidth)}
                // Two caps, both absolute rather than relative to a parent.
                // maxWidth is the file's own pixel width, so it is never
                // enlarged past its resolution; maxHeight is half the viewport,
                // which is what keeps the whole card inside the screen without
                // anything needing to scroll.
                //
                // Not flex-1 with max-h-full, which is what made the photo
                // disappear: flex-1 sets flex-basis to 0, and in a column with
                // no definite height of its own that resolves to zero height.
                style={{
                  ...(natural ? { maxWidth: `${natural}px` } : null),
                  maxHeight: "50dvh",
                }}
                className="mx-auto block h-auto w-auto max-w-full object-contain"
                draggable={false}
              />
            ) : (
              <CarPhoto
                src={undefined}
                alt={`${car.make} ${car.model}`}
                className="aspect-square w-full"
                color
              />
            )}
          </div>

          <p className="mt-4 truncate text-center text-lg font-bold">
            {car.make} {car.model}
          </p>
          {car.yearRange && (
            <p className="mt-0.5 text-center text-[15px] opacity-60">{car.yearRange}</p>
          )}

          {/* The meter, directly under the photo. */}
          <div
            className={cn(
              "mt-4 rounded-card p-3.5",
              ultra
                ? "bg-gradient-to-r from-neon-red/20 via-neon-green/12 to-neon-blue/20"
                : "bg-foreground/[0.06]",
            )}
          >
            <div className="flex items-baseline justify-between">
              <span className="util-label opacity-70">Rarity</span>
              <span className="text-sm font-bold">
                {raw}/100 · <span className="text-neon-red">{rarityLabel(raw)}</span>
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-background/40">
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
              <p className="mt-2.5 line-clamp-3 text-[15px] leading-relaxed opacity-75">
                {car.rarityReason}
              </p>
            )}
          </div>

          {/* Only when the pin is still up. Spots last a day and entries last
              forever, so most older cars have no map to go to and are not
              offered one. */}
          {spotId && (
            <Link
              href={`/map?spot=${encodeURIComponent(spotId)}`}
              className="press glass-card mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-bold"
            >
              <MapPin className="h-4 w-4 text-carz" strokeWidth={2.5} aria-hidden />
              See where it was spotted
            </Link>
          )}

          <button
            type="button"
            onClick={onClose}
            className="press mt-2 min-h-11 w-full rounded-full bg-carz text-sm font-bold text-carz-ink"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * useSearchParams suspends, so the page it is read in needs a boundary. The
 * fallback is the board's own skeleton rather than nothing, since arriving here
 * from a map pin should not flash an empty screen first.
 */
export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardFallback />}>
      <LeaderboardInner />
    </Suspense>
  );
}

function LeaderboardFallback() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10" aria-busy="true">
      <PageMasthead eyebrow="The board" title="Rarest Cars" count="—" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-card" />
        ))}
      </div>
    </main>
  );
}

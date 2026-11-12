/**
 * The rarity meter.
 *
 * Lifted out of spot/page.tsx unchanged. It was a local function there while
 * the scan result was the only screen that showed a score; the garage viewer
 * shows one too now, and a second copy of a meter is a second thing to keep in
 * step. Nothing about how it draws has changed.
 */
export function RarityMeter({ score, reason }: { score: number; reason?: string }) {
  if (!score || score <= 0) return null;
  const raw = Math.max(0, Math.round(score));
  const ultra = raw >= 100;
  const bar = Math.min(100, raw); // meter fills to 100
  const label = ultra
    ? "Ultra rare"
    : raw >= 85
      ? "Extremely rare"
      : raw >= 70
        ? "Rare"
        : raw >= 45
          ? "Uncommon"
          : raw >= 20
            ? "Fairly common"
            : "Common";
  return (
    <div
      className={`mt-4 rounded-card p-4 ${
        ultra
          ? "bg-gradient-to-r from-neon-red/15 via-neon-green/10 to-neon-blue/15 shadow-[0_0_25px_-8px_rgba(255,255,255,0.7)]"
          : "glass-chip"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide ">Rarity</span>
        <span className="text-[14px] font-bold">
          {raw}/100 · <span className={ultra ? "text-neon-red" : "text-neon-red"}>{label}</span>
        </span>
      </div>
      {/* A pure-black track punched a hole in the grey card. A tint of black
          reads as the same unfilled groove without the hard edge. */}
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-background/15">
        <div
          className={`h-full rounded-full ${
            ultra
              ? "bg-gradient-to-r from-neon-red via-neon-green to-neon-blue"
              : "bg-gradient-to-r from-neon-green via-neon-red to-neon-red"
          }`}
          style={{ width: `${bar}%` }}
        />
      </div>
      {reason && <p className="mt-2 text-[14px] ">{reason}</p>}
    </div>
  );
}

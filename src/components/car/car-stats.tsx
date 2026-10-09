import { ChevronDown } from "lucide-react";
import type { CarReport } from "@/lib/identify";

/**
 * The car stat sheet, shared by the page that scans a car and the page that
 * shows one somebody else already scanned.
 *
 * These lived inside spot/page.tsx, which was fine while Spot was the only
 * screen that could show a report. The leaderboard now opens an entry in full,
 * and a second copy of a rarity meter is a second thing to keep in step.
 */

export function Spec({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div className="glass-chip rounded-thumb p-3">
      <div className="text-[12px] uppercase tracking-wide ">{k}</div>
      <div className="mt-0.5 font-semibold">{v}</div>
    </div>
  );
}

export function fmtUsd(n: number): string {
  if (!n || n <= 0) return "";
  return "$" + Math.round(n).toLocaleString("en-US");
}

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

export function ValueChart({ points }: { points: { year: string; usd: number }[] }) {
  const pts = (points || []).filter((p) => p && typeof p.usd === "number" && p.usd > 0);
  if (pts.length < 2) return null;
  const W = 520, H = 150, padX = 48, padY = 22;
  const vals = pts.map((p) => p.usd);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => padX + (i * (W - padX * 2)) / (pts.length - 1);
  const y = (v: number) => padY + (1 - (v - min) / span) * (H - padY * 2);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.usd)}`).join(" ");
  const area = `${line} L ${x(pts.length - 1)} ${H - padY} L ${x(0)} ${H - padY} Z`;
  // Was green up, red down. Direction is already carried by the shape of the
  // line and by the figure beside it, so the colour was saying it a third time
  // -- and it was the one thing on this chart a colour-blind reader could not
  // read. Both lines are white.
  // currentColor, not #ffffff -- a literal white is invisible on the light
  // theme. Inheriting the text colour makes the line black on white and white
  // on black. Still one colour rather than green-up / red-down: direction is
  // already in the shape of the line and in the figures beside it.
  const stroke = "currentColor";
  return (
    <div className="mt-4 rounded-card glass-chip p-4 text-foreground">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide ">
          Market value over time
        </span>
        <span className="text-[14px] font-semibold">
          {fmtUsd(pts[0].usd)} to {fmtUsd(pts[pts.length - 1].usd)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full">
        <defs>
          <linearGradient id="valfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Three gridlines with their value, so the shape reads as amounts and
            not only as a direction. */}
        {[0, 0.5, 1].map((f) => {
          const gy = padY + f * (H - padY * 2);
          return (
            <g key={f}>
              <line x1={padX} y1={gy} x2={W - padX} y2={gy} stroke="currentColor" strokeOpacity="0.12" />
              <text x={padX - 8} y={gy + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.5">
                {fmtUsd(max - f * (max - min))}
              </text>
            </g>
          );
        })}
        <path d={area} fill="url(#valfill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.usd)} r="3.5" fill={stroke} />
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.5">
              {p.year}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/**
 * One collapsible row of the car detail.
 *
 * `has` rather than checking children for emptiness: a row whose fields are all
 * blank still renders a non-empty children array, so the row would open onto
 * nothing. The caller knows whether it has the data.
 */
export function DetailRow({
  label,
  has,
  open,
  children,
}: {
  label: string;
  has: boolean;
  /** Starts expanded. Still collapsible -- it is the initial state, not a lock. */
  open?: boolean;
  children: React.ReactNode;
}) {
  if (!has) return null;
  return (
    <details open={open} className="group border-b border-[var(--line-divider)]">
      <summary className="press flex min-h-14 cursor-pointer list-none items-center justify-between py-3 text-[15px] font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown
          className="h-[18px] w-[18px] shrink-0 text-[var(--color-muted-text)] transition-transform group-open:rotate-180"
          strokeWidth={1.75}
          aria-hidden
        />
      </summary>
      <div className="space-y-3 pb-4">{children}</div>
    </details>
  );
}

/**
 * Every collapsible section of a report, in the order Spot shows them.
 *
 * Takes whatever subset of a report it is given: an entry recorded before the
 * board kept specs has a rarity score and little else, and the rows it cannot
 * fill simply do not render.
 */
export function CarStatSheet({ car }: { car: Partial<CarReport> }) {
  return (
    <>
      <DetailRow label="Specs" has={!!(car.engine || car.drivetrain || car.bodyStyle)} open>
        <Spec k="Engine" v={car.engine} />
        <Spec k="Drivetrain" v={car.drivetrain} />
        <Spec k="Body style" v={car.bodyStyle} />
        <Spec k="Generation" v={car.generation} />
        <Spec k="Trim (guess)" v={car.trimGuess} />
        <Spec k="Colour" v={car.color} />
        <Spec k="Origin" v={car.countryOfOrigin} />
        <Spec k="Parent company" v={car.parentCompany} />
      </DetailRow>

      <DetailRow label="Performance" has={!!(car.horsepower || car.zeroToSixty || car.topSpeed)}>
        <Spec k="Horsepower" v={car.horsepower} />
        <Spec k="0\u201360 mph" v={car.zeroToSixty} />
        <Spec k="Top speed" v={car.topSpeed} />
      </DetailRow>

      <DetailRow
        label="Value"
        has={!!(car.priceRangeUsed || car.valuation || car.valueTimeline?.length)}
      >
        <Spec k="Retail" v={car.priceRangeUsed} />
        {car.valuation && <p className="text-[15px] leading-relaxed text-foreground">{car.valuation}</p>}
        {car.reliability && <p className="text-[15px] leading-relaxed text-foreground">{car.reliability}</p>}
        {car.collectibility && (
          <p className="text-[15px] leading-relaxed text-foreground">{car.collectibility}</p>
        )}
        {car.valueTimeline && <ValueChart points={car.valueTimeline} />}
      </DetailRow>

      <DetailRow label="Rarity" has={!!car.rarityScore}>
        <RarityMeter score={car.rarityScore ?? 0} reason={car.rarityReason} />
      </DetailRow>
    </>
  );
}

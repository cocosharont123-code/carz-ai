"use client";

/**
 * The pricing section.
 *
 * Structure and motion come from the supplied component: a staggered reveal
 * keyed to the section, a vertical-cut heading, a pill switch with a sliding
 * selection, and prices that roll between values rather than cutting.
 *
 * Its palette does not. The original is a white ground with a blue radial
 * gradient and grey type, which would have been the only screen in the app
 * that looked like that. It is rebuilt on the app's own tokens — glass over
 * the shader background, `--color-carz` for the accent — because the design
 * rules say not to introduce colours, and a pricing page is the last screen
 * that should look borrowed.
 *
 * Presentational only: every price, label and handler is passed in, so the
 * page above it owns membership, promos and billing, and there is one place
 * where what is charged is decided.
 */

import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { CheckCheck, Zap } from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useId, useRef, useState, type ReactNode } from "react";

/* --- The billing switch --------------------------------------------------- */

export const PricingSwitch = ({
  button1,
  button2,
  value,
  onSwitch,
  className,
  layoutId,
  label,
}: {
  button1: string;
  button2: string;
  /** "0" or "1". Controlled, so the page can restore a member's own billing. */
  value?: string;
  onSwitch: (value: string) => void;
  className?: string;
  layoutId?: string;
  label?: string;
}) => {
  const [internal, setInternal] = useState("0");
  const selected = value ?? internal;
  const uniqueId = useId();
  const switchLayoutId = layoutId || `switch-${uniqueId}`;
  const reduceMotion = useReducedMotion() === true;

  const handleSwitch = (next: string) => {
    setInternal(next);
    onSwitch(next);
  };

  const option = (key: string, text: string) => (
    <button
      type="button"
      onClick={() => handleSwitch(key)}
      aria-pressed={selected === key}
      className={cn(
        // h-12, not the original's h-10: 40px is under the 44pt tap minimum.
        "press relative z-10 h-12 w-full rounded-full px-4 text-sm font-semibold transition-colors sm:h-14 sm:px-6",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carz/60",
        selected === key ? "text-black" : "opacity-70 hover:opacity-100",
      )}
    >
      {selected === key &&
        (reduceMotion ? (
          <span className="absolute inset-0 rounded-full bg-white" />
        ) : (
          <motion.span
            layoutId={switchLayoutId}
            className="absolute inset-0 rounded-full bg-white"
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        ))}
      <span className="relative">{text}</span>
    </button>
  );

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "glass-card relative z-10 grid w-full grid-cols-2 rounded-full p-1",
        className,
      )}
    >
      {option("0", button1)}
      {option("1", button2)}
    </div>
  );
};

/* --- Tiers ---------------------------------------------------------------- */

export type PricingTier = {
  id: string;
  name: string;
  blurb: string;
  /** What they pay today, after any discount. */
  price: number;
  /** Struck through beside the price when a promo is applied. */
  wasPrice?: number;
  interval: "mo" | "yr";
  /** Sits above the list, e.g. "Everything in Carz+, plus:". */
  perksLead?: string;
  perks: readonly { readonly title: string; readonly desc?: string }[];
  /** Ranked first visually. Paired with a text badge, never colour alone. */
  featured?: boolean;
  badge?: string;
  /** Omit for a tier already held: the card then renders with no button. */
  cta?: string;
  onSelect?: () => void;
  note?: string;
};

function TierCard({
  tier,
  index,
  sectionRef,
  variants,
  busy,
}: {
  tier: PricingTier;
  index: number;
  sectionRef: React.RefObject<HTMLDivElement | null>;
  variants: Variants;
  busy?: boolean;
}) {
  return (
    <TimelineContent
      as="div"
      animationNum={index}
      timelineRef={sectionRef}
      customVariants={variants}
      className={cn(
        "glass-card flex flex-col rounded-3xl p-6 sm:p-7",
        tier.featured && "ring-1 ring-carz/40",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="display text-xl">{tier.name}</h3>
        {tier.badge && (
          <span className="util-label rounded-full bg-carz/15 px-3 py-1 text-carz">
            {tier.badge}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-sm opacity-70">{tier.blurb}</p>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="display text-4xl">
          $
          <NumberFlow value={tier.price} format={{ minimumFractionDigits: 2 }} />
        </span>
        <span className="text-sm opacity-60">/{tier.interval}</span>
        {tier.wasPrice !== undefined && tier.wasPrice > tier.price && (
          <span className="text-sm line-through opacity-40">
            ${tier.wasPrice.toFixed(2)}
          </span>
        )}
      </div>

      {tier.perksLead && (
        <p className="mt-5 text-sm font-semibold opacity-80">{tier.perksLead}</p>
      )}
      <ul className={cn("space-y-3", tier.perksLead ? "mt-3" : "mt-5")}>
        {tier.perks.map((perk) => (
          <li key={perk.title} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-carz/15">
              <CheckCheck className="h-3 w-3 text-carz" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-sm leading-snug">
              <span className="font-semibold">{perk.title}</span>
              {perk.desc && <span className="opacity-60"> — {perk.desc}</span>}
            </span>
          </li>
        ))}
      </ul>

      {/* Pushes the button to the bottom so two cards of different heights
          still line their calls to action up. */}
      <div className="flex-1" />

      {tier.cta && (
        <button
          type="button"
          onClick={tier.onSelect}
          disabled={busy}
          className={cn(
            "press mt-6 flex min-h-11 w-full items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carz/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            tier.featured
              ? "bg-white text-black hover:opacity-90"
              : "glass-card hover:bg-white/[0.08]",
          )}
        >
          {tier.cta}
        </button>
      )}
      {tier.note && (
        <p className="mt-2.5 text-center text-xs opacity-50">{tier.note}</p>
      )}
    </TimelineContent>
  );
}

/* --- The section ---------------------------------------------------------- */

export default function PricingSection({
  eyebrow,
  title,
  subtitle,
  tiers,
  billing,
  onBillingSwitch,
  busy,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  tiers: PricingTier[];
  /** Omit to hide the switch, as for a member whose billing is already set. */
  billing?: { value: string; monthlyLabel: string; annualLabel: string };
  onBillingSwitch?: (value: string) => void;
  busy?: boolean;
  /** Promo box, errors, anything the page wants under the cards. */
  children?: ReactNode;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);

  const revealVariants: Variants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: "blur(0px)",
      // 0.3s a step, inside the 200-350ms the rules ask for.
      transition: { delay: i * 0.08, duration: 0.3, ease: "easeInOut" },
    }),
    hidden: { filter: "blur(10px)", y: -20, opacity: 0 },
  };

  return (
    <div ref={sectionRef} className="mx-auto w-full max-w-3xl px-5 py-10">
      <div className="text-center">
        <TimelineContent
          as="div"
          animationNum={0}
          timelineRef={sectionRef}
          customVariants={revealVariants}
          className="flex items-center justify-center gap-2"
        >
          <Zap className="h-4 w-4 fill-carz text-carz" aria-hidden />
          <span className="util-label text-carz">{eyebrow}</span>
        </TimelineContent>

        <h1 className="display mt-4 text-4xl sm:text-5xl">
          <VerticalCutReveal
            splitBy="words"
            staggerDuration={0.12}
            staggerFrom="first"
            reverse
            containerClassName="justify-center"
            transition={{ type: "spring", stiffness: 250, damping: 40, delay: 0.15 }}
          >
            {title}
          </VerticalCutReveal>
        </h1>

        <TimelineContent
          as="p"
          animationNum={1}
          timelineRef={sectionRef}
          customVariants={revealVariants}
          className="mx-auto mt-3 max-w-md text-sm leading-relaxed opacity-70"
        >
          {subtitle}
        </TimelineContent>
      </div>

      {billing && onBillingSwitch && (
        <TimelineContent
          as="div"
          animationNum={2}
          timelineRef={sectionRef}
          customVariants={revealVariants}
          className="mx-auto mt-7 max-w-xs"
        >
          <PricingSwitch
            button1={billing.monthlyLabel}
            button2={billing.annualLabel}
            value={billing.value}
            onSwitch={onBillingSwitch}
            label="Billing period"
          />
        </TimelineContent>
      )}

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {tiers.map((tier, i) => (
          <TierCard
            key={tier.id}
            tier={tier}
            index={3 + i}
            sectionRef={sectionRef}
            variants={revealVariants}
            busy={busy}
          />
        ))}
      </div>

      {children}
    </div>
  );
}

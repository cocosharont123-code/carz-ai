"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";

/**
 * One step of a staggered reveal, tied to a container rather than to itself.
 *
 * This file did not come with the component that imports it, so it is written
 * to the contract its call sites imply: every step watches the same
 * `timelineRef` and holds its `hidden` variant until that container scrolls
 * into view, then plays its `visible` variant with `animationNum` passed
 * through as the custom value the variants use to compute their delay.
 *
 * Keying the trigger to the container is the point. Steps that each watched
 * themselves would fire as the reader scrolled past them one by one, so the
 * stagger would never be seen; watching one element makes the whole section
 * play as a sequence the moment any of it is on screen.
 */

// A fixed map rather than a dynamic lookup, so `as` stays a checked union and
// nothing has to be cast to render it.
const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  p: motion.p,
  span: motion.span,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  li: motion.li,
  button: motion.button,
} as const;

export type TimelineTag = keyof typeof MOTION_TAGS;

export function TimelineContent({
  children,
  as = "div",
  animationNum,
  timelineRef,
  customVariants,
  className,
  once = true,
  onClick,
  ...rest
}: {
  children?: ReactNode;
  /** Which element to render. Defaults to a div. */
  as?: TimelineTag;
  /** This step's index, handed to the variants as their custom value. */
  animationNum: number;
  /** The container whose visibility starts the whole sequence. */
  timelineRef: RefObject<HTMLElement | null>;
  customVariants?: Variants;
  className?: string;
  /** Replay every time the container re-enters the viewport. */
  once?: boolean;
  onClick?: () => void;
}) {
  const Tag = MOTION_TAGS[as];
  const fallbackRef = useRef<HTMLElement>(null);
  // A ref that never attaches reports "not in view" forever, which would leave
  // the whole section invisible. Fall back to playing rather than hiding.
  const target = timelineRef ?? fallbackRef;
  const inView = useInView(target, { once });

  // The reveal carries no information — it is the same content either way — so
  // under reduce-motion it is rendered plainly, with no initial hidden state.
  const reduceMotion = useReducedMotion() === true;

  const defaultVariants: Variants = {
    hidden: { opacity: 0, y: -20, filter: "blur(10px)" },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { delay: i * 0.1, duration: 0.3, ease: "easeInOut" },
    }),
  };

  if (reduceMotion) {
    const Plain = as;
    return (
      <Plain className={className} onClick={onClick} {...rest}>
        {children}
      </Plain>
    );
  }

  return (
    <Tag
      custom={animationNum}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={customVariants ?? defaultVariants}
      className={className}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default TimelineContent;

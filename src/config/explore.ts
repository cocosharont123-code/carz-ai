// Every feature in Carz, as one grid of bubbles.
//
// All Explore copy lives here rather than in the page, so the wording of the
// whole app's front door can be reviewed in one file without reading JSX.
//
// Rules the labels follow, deliberately:
//   - Short enough to sit inside a bubble. Where two features share a page,
//     the bubble is named for both ("Auctions & Wishlist") and opens the page
//     they share — the second one is a tab once you arrive.
//   - One line underneath saying what it does, eight words at most.
//   - Every href is a route that exists. Features that live inside another
//     page — the customizer, the value chart, the hotspots map — are not
//     listed, because there is nowhere to send someone.

import { CARZ_PLUS, CARZ_MAX } from "@/lib/plans";
import type { MemberTier } from "@/lib/profile-blob";
import {
  Bot,
  Crosshair,
  Crown,
  Trophy,
  Images,
  ScanLine,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ExploreItem = {
  /** Short enough to read inside a bubble at a glance. */
  label: string;
  /** What it does, eight words at most. */
  description: string;
  href: string;
  icon: LucideIcon;
  /** Which tier this needs, shown as a badge. The link still works — the
   *  destination already gates itself, and a second copy of that logic here
   *  could only ever disagree with the first. */
  tier?: MemberTier;
};

export const EXPLORE_COPY = {
  /** One line under the wordmark. An eyebrow, a title and a subtitle all said
   *  the same thing and pushed the first tappable thing off the screen. */
  tagline: "Everything in Carz — tap anything to jump in.",
  searchPlaceholder: "Search: spot, auctions, garage…",
  searchLabel: "Search features",
  empty: "Nothing matches. Try “spot” or “auctions”.",
  /** Read from the plans themselves, so a renamed tier cannot leave a stale
   *  badge behind on the menu. */
  tierBadge: { plus: CARZ_PLUS.name, max: CARZ_MAX.name } as Record<MemberTier, string>,
} as const;

/**
 * The whole app, in the order the tiles are laid out.
 *
 * Events & Drops is a pair by theme rather than by page, so it opens Events.
 * Anything gated gets its own entry rather than being paired with something
 * public, or the public half ends up behind the gate.
 */
export const EXPLORE_BUBBLES: ExploreItem[] = [
  {
    label: "Spot",
    description: "Identify any car from a photo",
    href: "/spot",
    icon: ScanLine,
  },
  {
    label: "CarzBot",
    description: "Ask anything about cars",
    href: "/carzbot",
    icon: Bot,
  },
  {
    label: "Feed",
    description: "Watch car clips from everyone",
    href: "/feed",
    icon: Users,
  },
  {
    label: "Garage",
    description: "A photo album of cars you saved",
    href: "/garage",
    icon: Images,
    tier: "plus",
  },
  // Its own entry, not folded into Garage. They are tabs on one page, but
  // Garage is members-only and the leaderboard is not — pairing them put a
  // public page behind an upsell wall with no other way in.
  {
    label: "Leaderboard",
    description: "The rarest cars anyone has found",
    href: "/leaderboard",
    icon: Trophy,
  },
  {
    label: "Events & Drops",
    description: "Car meets and new supercar launches",
    href: "/events",
    icon: Ticket,
    tier: "max",
  },
  {
    label: "Hunt",
    description: "Find a wanted car, win the bounty",
    href: "/hunt",
    icon: Crosshair,
    tier: "plus",
  },
  // Last, because it is the one tile that sells something rather than doing
  // something. Named for both tiers under the rule above: they are one page
  // with a choice on it, not two features, and a menu that only says "Carz+"
  // is a menu MAX cannot be found from.
  {
    label: "Carz+ & Carz MAX",
    description: "Everything membership unlocks",
    href: "/pricing",
    icon: Crown,
  },
];


/**
 * Matches a bubble against a typed query — label first, then description, so
 * someone typing "bid" finds Auctions by what it does rather than only by what
 * it is called. Case- and whitespace-insensitive; an empty query matches
 * everything, which is what makes the unfiltered grid and the filtered grid the
 * same render path.
 */
export function matchesExploreQuery(item: ExploreItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
  );
}

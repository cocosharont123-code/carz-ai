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

import {
  Crown,
  Gavel,
  Images,
  KeyRound,
  LogIn,
  ScanLine,
  Settings,
  ShieldCheck,
  Ticket,
  User,
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
  /** Shown as the existing Carz+ label. The link still works — the destination
   *  already gates itself, and a second copy of that logic here could only
   *  ever disagree with the first. */
  membersOnly?: boolean;
};

export const EXPLORE_COPY = {
  /** One line under the wordmark. An eyebrow, a title and a subtitle all said
   *  the same thing and pushed the first tappable thing off the screen. */
  tagline: "Everything in Carz — tap anything to jump in.",
  searchPlaceholder: "Search: spot, auctions, garage…",
  searchLabel: "Search features",
  empty: "Nothing matches. Try “spot” or “auctions”.",
  /** Sits on a members-only bubble. Same wording the gate itself uses. */
  membersBadge: "Carz+",
} as const;

/**
 * The whole app, in tap order: what people came to do first, then the rest,
 * then the account.
 *
 * A paired bubble opens the feature it is named for first. Auctions & Wishlist
 * and Garage & Ranks land on pages where the other half is genuinely a tab, so
 * both are one tap away. Events & Drops and Carz+ & Hunt are pairs by theme
 * rather than by page, so those open Events and Carz+ respectively.
 */
export const EXPLORE_BUBBLES: ExploreItem[] = [
  {
    label: "Spot",
    description: "Identify any car from a photo",
    href: "/spot",
    icon: ScanLine,
  },
  {
    label: "Auctions & Wishlist",
    description: "Bid live, save the cars you want",
    href: "/auctions",
    icon: Gavel,
  },
  {
    label: "Garage & Ranks",
    description: "Your saved cars and the leaderboard",
    href: "/garage",
    icon: Images,
    membersOnly: true,
  },
  {
    label: "Events & Drops",
    description: "Car meets and new supercar launches",
    href: "/events",
    icon: Ticket,
    membersOnly: true,
  },
  {
    label: "Carz+ & Hunt",
    description: "Membership perks and cash bounties",
    href: "/pricing",
    icon: Crown,
  },
  {
    label: "Feed",
    description: "Watch car clips from everyone",
    href: "/feed",
    icon: Users,
  },
  {
    label: "Sell a car",
    description: "Free listing, AI writes it for you",
    href: "/auctions/new",
    icon: KeyRound,
  },
];

/**
 * Account and housekeeping. Split out of the grid because they were competing
 * with the features at exactly the same size, and nobody opens a car app to
 * read the terms — they belong at the bottom, small, where you go looking for
 * them on purpose. Still searchable, so typing "terms" finds them.
 */
export const EXPLORE_LINKS: ExploreItem[] = [
  {
    label: "Profile",
    description: "Your name, photo and spotting stats",
    href: "/profile",
    icon: User,
  },
  {
    label: "Settings",
    description: "Scan quality and account controls",
    href: "/settings",
    icon: Settings,
  },
  {
    label: "Sign in",
    description: "Sign in or create an account",
    href: "/signin",
    icon: LogIn,
  },
  {
    label: "Terms",
    description: "How Carz works and handles data",
    href: "/terms",
    icon: ShieldCheck,
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

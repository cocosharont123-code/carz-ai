// Every feature in Carz, in one list, written for someone who has had the app
// for ten seconds.
//
// All Explore copy lives here rather than in the page, so the wording of the
// whole app's front door can be reviewed in one file without reading JSX.
//
// Rules the labels follow, deliberately:
//   - Plain nouns, three words at most. No internal names — nobody arriving
//     knows what a "restyle" or a "spot" is.
//   - One line of description, eight words at most, saying what the feature
//     does rather than what it is called.
//   - Every href is a route that exists. Features that live inside another
//     page (the customizer, the value chart, the hotspots map) are not listed
//     as destinations, because there is nowhere to send someone.

import {
  Barcode,
  Camera,
  Crosshair,
  Crown,
  Gavel,
  Heart,
  Images,
  KeyRound,
  LogIn,
  Palette,
  Rocket,
  ScanLine,
  Settings,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ExploreItem = {
  /** Plain noun, three words at most. */
  label: string;
  /** What it does, eight words at most. */
  description: string;
  href: string;
  icon: LucideIcon;
  /** Shown as the existing Carz+ label. The link still works — the feature's
   *  own gate handles what happens on arrival, and it is not rebuilt here. */
  membersOnly?: boolean;
  /** Signing in is required by the destination itself; same principle. */
  requiresAuth?: boolean;
};

export type ExploreSection = {
  title: string;
  items: ExploreItem[];
};

export const EXPLORE_COPY = {
  eyebrow: "Everything in Carz",
  title: "Explore",
  subtitle: "Every feature in one place — tap anything to jump straight in.",
  searchPlaceholder: "Search: scan, auctions, map…",
  searchLabel: "Search features",
  startHere: "Start here",
  empty: "Nothing matches. Try “scan” or “auctions”.",
  /** Sits beside a members-only row. Same wording the gate itself uses. */
  membersBadge: "Carz+",
} as const;

/** The three things a new user most likely came to do. */
export const EXPLORE_START_HERE: ExploreItem[] = [
  {
    label: "Scan a car",
    description: "Identify any car from a photo",
    href: "/spot",
    icon: ScanLine,
  },
  {
    label: "Auctions",
    description: "Bid on cars live",
    href: "/auctions",
    icon: Gavel,
  },
  {
    label: "Sell a car",
    description: "Free listing, AI writes it for you",
    href: "/auctions/new",
    icon: KeyRound,
    requiresAuth: true,
  },
];

export const EXPLORE_SECTIONS: ExploreSection[] = [
  {
    title: "Spot & identify",
    items: [
      {
        label: "Scan a car",
        description: "Identify any car from a photo",
        href: "/spot",
        icon: ScanLine,
      },
      {
        label: "Scan a VIN",
        description: "Photograph the VIN, get the exact car",
        href: "/spot",
        icon: Barcode,
      },
      {
        label: "Your garage",
        description: "A photo album of cars you saved",
        href: "/garage",
        icon: Images,
        membersOnly: true,
      },
      {
        label: "Saved builds",
        description: "Car colours and rims you designed",
        href: "/garage/builds",
        icon: Palette,
        membersOnly: true,
      },
    ],
  },
  {
    title: "Buy & sell",
    items: [
      {
        label: "Auctions",
        description: "Bid on cars live",
        href: "/auctions",
        icon: Gavel,
      },
      {
        label: "Sell a car",
        description: "Free listing, AI writes it for you",
        href: "/auctions/new",
        icon: KeyRound,
        requiresAuth: true,
      },
      {
        label: "New drops",
        description: "Just-launched supercars over $120k",
        href: "/drops",
        icon: Rocket,
      },
      {
        label: "Wishlist",
        description: "Get told when your car appears",
        href: "/wishlist",
        icon: Heart,
        membersOnly: true,
      },
    ],
  },
  {
    title: "Near you",
    items: [
      {
        label: "Car events",
        description: "Meets, shows and track days nearby",
        href: "/events",
        icon: Ticket,
        membersOnly: true,
      },
      {
        label: "Car Hunt Miami",
        description: "Find a wanted car, win the bounty",
        href: "/hunt",
        icon: Crosshair,
        membersOnly: true,
      },
    ],
  },
  {
    title: "Compete & play",
    items: [
      {
        label: "Rarest cars",
        description: "The leaderboard of rarest finds",
        href: "/leaderboard",
        icon: Trophy,
      },
      {
        label: "Community",
        description: "Watch car clips from everyone",
        href: "/feed",
        icon: Users,
      },
      {
        label: "Post a clip",
        description: "Share a car you filmed",
        href: "/feed/new",
        icon: Camera,
        requiresAuth: true,
      },
    ],
  },
  {
    title: "Carz+",
    items: [
      {
        label: "What you get",
        description: "Everything membership unlocks",
        href: "/pricing",
        icon: Crown,
      },
      {
        label: "Membership",
        description: "Start your free trial",
        href: "/membership",
        icon: Sparkles,
        requiresAuth: true,
      },
      {
        label: "Redeem a code",
        description: "Turn a promo code into membership",
        href: "/membership",
        icon: Tag,
        requiresAuth: true,
      },
    ],
  },
  {
    title: "Account & help",
    items: [
      {
        label: "Your profile",
        description: "Name, photo and spotting stats",
        href: "/profile",
        icon: User,
        requiresAuth: true,
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
        label: "Terms & privacy",
        description: "How Carz works and handles data",
        href: "/terms",
        icon: ShieldCheck,
      },
    ],
  },
];

/**
 * Matches an item against a typed query — label first, then description, so
 * someone typing "map" finds the hunt board by what it does rather than only by
 * what it is called. Case- and whitespace-insensitive; an empty query matches
 * everything, which is what makes the unfiltered page and the filtered page the
 * same render path.
 */
export function matchesExploreQuery(item: ExploreItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
  );
}

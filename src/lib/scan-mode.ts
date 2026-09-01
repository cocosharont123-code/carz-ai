// How hard a scan tries. The identification pipeline can run as a single
// wide-shot look, or as the full cross-checked chain — one independent second
// opinion, a magnified read of the deciding detail, and an adjudicator that
// sees both when they disagree.
//
// That chain is what makes a contested car come out right, and it costs up to
// four model calls instead of one. So it's the Carz+ perk: free spotters get
// the quick single look, members choose.

export type ScanMode = "fast" | "precise";

export const SCAN_MODE_COOKIE = "cs_scan_mode";

/** What a spotter gets when they've never touched the setting. */
export const DEFAULT_SCAN_MODE: ScanMode = "fast";

export function isScanMode(s: string | null | undefined): s is ScanMode {
  return s === "fast" || s === "precise";
}

/**
 * The mode a scan will actually run in. Precise is members-only, so a stale
 * cookie left behind by a lapsed membership quietly falls back rather than
 * handing out the expensive pipeline for free.
 */
export function effectiveScanMode(
  cookieValue: string | null | undefined,
  isMember: boolean,
): ScanMode {
  const wanted = isScanMode(cookieValue) ? cookieValue : DEFAULT_SCAN_MODE;
  return wanted === "precise" && !isMember ? "fast" : wanted;
}

/**
 * What the two modes are called and what they promise.
 *
 * Kept here rather than in either page because both the spotter's picker and
 * the settings screen show the same two choices — if the names lived in one of
 * them, the other would eventually disagree with it about what the app offers.
 * Strings only: this module is imported by API routes, and icons belong to
 * whichever page is drawing them.
 */
export const SCAN_MODE_META: Record<
  ScanMode,
  { name: string; tagline: string; detail: string; premium: boolean }
> = {
  fast: {
    name: "Lightning",
    tagline: "Instant · for more basic cars",
    detail:
      "One look at the photo and an answer straight back. Made for the everyday cars you'll point it at most — near-identical trims and lookalike generations are what PRO is for.",
    premium: false,
  },
  precise: {
    name: "PRO",
    tagline: "A little slower · almost 100% accurate",
    detail:
      "Runs a second independent look, magnifies the one detail that decides it — a badge, a taillight's internals — and brings in a third opinion to settle any disagreement. This is what catches the cars Lightning gets wrong.",
    premium: true,
  },
};

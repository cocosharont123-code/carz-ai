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

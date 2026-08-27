import { TERMS_VERSION } from "./terms";

// Whether this browser has accepted the Terms, and which version of them.
// Stored on the device like the garage and hunt state, so it works signed out
// and needs no database.

const KEY = "carz_terms_accepted_v1";

export type TermsAcceptance = {
  version: string;
  at: number;
};

export function getAcceptance(): TermsAcceptance | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TermsAcceptance>;
    if (typeof parsed?.version !== "string" || typeof parsed?.at !== "number") return null;
    return { version: parsed.version, at: parsed.at };
  } catch {
    return null;
  }
}

/**
 * True only for the version currently published. Accepting an older text does
 * not carry forward — if the Terms are revised, TERMS_VERSION moves and the
 * acceptance has to be given again against the new wording.
 */
export function hasAcceptedCurrent(): boolean {
  return getAcceptance()?.version === TERMS_VERSION;
}

export function acceptTerms(): TermsAcceptance {
  const record: TermsAcceptance = { version: TERMS_VERSION, at: Date.now() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* storage full or blocked — the page still reflects the acceptance for this session */
  }
  return record;
}

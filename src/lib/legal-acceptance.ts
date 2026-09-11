// Whether this browser has accepted a legal document, and which version of it.
//
// Stored on the device like the garage and hunt state, so it works signed out
// and needs no database. One factory rather than a copy per document: the rule
// that an acceptance is only good for the exact version it was given against is
// the whole point of the record, and it should not be possible for the Terms
// and the Privacy Policy to disagree about it.

export type LegalAcceptance = {
  version: string;
  at: number;
};

export type AcceptanceStore = {
  get(): LegalAcceptance | null;
  hasAcceptedCurrent(): boolean;
  accept(): LegalAcceptance;
};

export function acceptanceStore(key: string, currentVersion: string): AcceptanceStore {
  function get(): LegalAcceptance | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<LegalAcceptance>;
      if (typeof parsed?.version !== "string" || typeof parsed?.at !== "number") return null;
      return { version: parsed.version, at: parsed.at };
    } catch {
      return null;
    }
  }

  return {
    get,
    /**
     * True only for the version currently published. Accepting an older text
     * does not carry forward: if the document is revised, its version moves and
     * the acceptance has to be given again against the new wording.
     */
    hasAcceptedCurrent: () => get()?.version === currentVersion,
    accept() {
      const record: LegalAcceptance = { version: currentVersion, at: Date.now() };
      try {
        window.localStorage.setItem(key, JSON.stringify(record));
      } catch {
        /* storage full or blocked; the page still reflects it for this session */
      }
      return record;
    },
  };
}

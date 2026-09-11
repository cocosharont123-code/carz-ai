import { TERMS_VERSION } from "./terms";
import { acceptanceStore, type LegalAcceptance } from "./legal-acceptance";

// The Terms acceptance record. The storage key is unchanged from when this
// module held its own implementation, so acceptances already given still count.

export type TermsAcceptance = LegalAcceptance;

const store = acceptanceStore("carz_terms_accepted_v1", TERMS_VERSION);

export function getAcceptance(): TermsAcceptance | null {
  return store.get();
}

export function hasAcceptedCurrent(): boolean {
  return store.hasAcceptedCurrent();
}

export function acceptTerms(): TermsAcceptance {
  return store.accept();
}

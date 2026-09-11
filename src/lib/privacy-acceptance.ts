import { PRIVACY_VERSION } from "./privacy";
import { acceptanceStore, type LegalAcceptance } from "./legal-acceptance";

// The Privacy Policy acceptance record. Kept under its own key and its own
// version so revising one document does not silently invalidate the other.

export type PrivacyAcceptance = LegalAcceptance;

const store = acceptanceStore("carz_privacy_accepted_v1", PRIVACY_VERSION);

export function getPrivacyAcceptance(): PrivacyAcceptance | null {
  return store.get();
}

export function hasAcceptedPrivacy(): boolean {
  return store.hasAcceptedCurrent();
}

export function acceptPrivacy(): PrivacyAcceptance {
  return store.accept();
}

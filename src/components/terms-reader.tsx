"use client";

import { LegalReader, type LegalDoc } from "@/components/legal-reader";
import {
  TERMS_SECTIONS,
  TERMS_INTRO,
  TERMS_ENTITY,
  TERMS_CONTACT_EMAIL,
  TERMS_AI_NOTICE,
} from "@/lib/terms";
import { acceptTerms } from "@/lib/terms-acceptance";

const TERMS_DOC: LegalDoc = {
  label: "Terms of Service",
  intro: TERMS_INTRO,
  sections: TERMS_SECTIONS,
  sectionNote: TERMS_AI_NOTICE,
  entity: TERMS_ENTITY,
  contactEmail: TERMS_CONTACT_EMAIL,
};

/** The Terms in the shared scroll-to-the-end reader. */
export function TermsReader({
  paneHeightClass,
  showAccept = true,
  onAccepted,
}: {
  paneHeightClass?: string;
  showAccept?: boolean;
  onAccepted?: (at: number) => void;
}) {
  return (
    <LegalReader
      doc={TERMS_DOC}
      paneHeightClass={paneHeightClass}
      showAccept={showAccept}
      acceptLabel="I have read and accept these Terms"
      accept={() => acceptTerms().at}
      onAccepted={onAccepted}
    />
  );
}

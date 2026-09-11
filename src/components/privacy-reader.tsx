"use client";

import { LegalReader, type LegalDoc } from "@/components/legal-reader";
import {
  PRIVACY_SECTIONS,
  PRIVACY_INTRO,
  PRIVACY_ENTITY,
  PRIVACY_CONTACT,
} from "@/lib/privacy";
import { acceptPrivacy } from "@/lib/privacy-acceptance";

const PRIVACY_DOC: LegalDoc = {
  label: "Privacy Policy",
  intro: PRIVACY_INTRO,
  sections: PRIVACY_SECTIONS,
  entity: PRIVACY_ENTITY,
  contactEmail: PRIVACY_CONTACT,
};

/** The Privacy Policy in the shared scroll-to-the-end reader. */
export function PrivacyReader({
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
      doc={PRIVACY_DOC}
      paneHeightClass={paneHeightClass}
      showAccept={showAccept}
      acceptLabel="I have read and accept this Privacy Policy"
      accept={() => acceptPrivacy().at}
      onAccepted={onAccepted}
    />
  );
}

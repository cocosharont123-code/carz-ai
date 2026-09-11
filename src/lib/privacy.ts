// The Privacy Policy, as structured data rather than markup, so the page can
// number sections and render them anywhere without duplicating the text.
//
// Reproduced verbatim from the copy supplied by Carzfinder LLC. Do not
// paraphrase, tighten, or "fix" anything here — it is a published legal
// statement about what the app does with people's data, and editing it to
// match the code would be changing the promise rather than keeping it.
//
// Several statements in it do not currently match the app. They are left
// exactly as written and reported to the owner instead; see the note in the
// commit that added this file.

import type { TermsBlock } from "./terms";

export type PrivacySection = { title: string; blocks: TermsBlock[] };

export const PRIVACY_UPDATED = "September 11, 2026";
export const PRIVACY_ENTITY = "Carzfinder LLC";
export const PRIVACY_CONTACT = "privacy@carz.dev";

export const PRIVACY_INTRO =
  'carz.dev ("we," "us," "our," "Carzfinder LLC") operates the carz.dev website and mobile application (the "App"). This Privacy Policy explains how we collect, use, and protect your information when you use the App.';

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: "Age Requirement — 18+ Only",
    blocks: [
      {
        kind: "p",
        text: "The App is strictly for users aged 18 and older. By creating an account or using the App, you represent and warrant that you are at least 18 years old.",
      },
      {
        kind: "ul",
        items: [
          "We do not knowingly collect, solicit, or store personal information from anyone under 18.",
          "If we learn that a user is under 18, we will terminate that account and delete the associated data as soon as reasonably possible.",
          "If you believe a user under 18 has provided us with personal information, contact us immediately at the email below so we can investigate and remove it.",
          "Users under 18 are not authorized to use the App under any circumstances, including with parental consent.",
        ],
      },
    ],
  },
  {
    title: "Information We Collect",
    blocks: [
      {
        kind: "ul",
        items: [
          "Account information: name, email address, and profile data collected via Google OAuth sign-in.",
          "Photos and vehicle data: images you upload for car spotting, identification, and customization features.",
          "Location data: approximate or precise location used for the car hotspot map and local car events, where you enable it.",
          "Payment information: processed by Stripe for Carz+ membership subscriptions and seller listing fees; we do not store full payment card details ourselves.",
          "Usage data: app activity such as scans, saved listings, bids, leaderboard activity, and garage history.",
          "Device and technical data: IP address, device type, and log data collected automatically.",
        ],
      },
    ],
  },
  {
    title: "How We Use Your Information",
    blocks: [
      {
        kind: "ul",
        items: [
          "To provide core features: car identification, market pricing, auctions, and bidding.",
          "To process payments and manage Carz+ memberships and seller fees.",
          "To operate the leaderboard, hotspot map, and Miami Car Hunt features.",
          "To communicate with you about your account, transactions, and updates.",
          "To detect fraud, stolen-vehicle listings, and abuse of the platform.",
          "To improve and personalize the App's features.",
        ],
      },
    ],
  },
  {
    title: "Sharing of Information",
    blocks: [
      { kind: "p", text: "We do not sell your personal information. We may share data with:" },
      {
        kind: "ul",
        items: [
          "Service providers: Stripe (payments), Google (authentication), Vercel (hosting and storage), and similar infrastructure providers who process data on our behalf.",
          "Auction and listing counterparties: buyer/seller information necessary to complete a transaction you initiate.",
          "Legal compliance: where required by law, court order, or to protect the safety and rights of users or the public.",
          "Business transfers: in connection with a merger, acquisition, or sale of assets.",
        ],
      },
    ],
  },
  {
    title: "Data Retention",
    blocks: [
      {
        kind: "p",
        text: "We retain your information for as long as your account is active or as needed to provide the App's features, comply with legal obligations, resolve disputes, and enforce our agreements.",
      },
    ],
  },
  {
    title: "Your Choices and Rights",
    blocks: [
      {
        kind: "ul",
        items: [
          "You may access, update, or delete your account information by contacting us.",
          "You may disable location permissions in your device settings; some features may not work without it.",
          "You may cancel your Carz+ membership at any time; cancellation takes effect at the end of the current billing period.",
        ],
      },
    ],
  },
  {
    title: "Data Security",
    blocks: [
      {
        kind: "p",
        text: "We use reasonable technical and organizational measures to protect your information. No method of transmission or storage is 100% secure, and we cannot guarantee absolute security.",
      },
    ],
  },
  {
    title: "Third-Party Services",
    blocks: [
      {
        kind: "p",
        text: "The App integrates with third-party services (e.g., Google OAuth, Stripe, eBay Motors) that have their own privacy policies. We encourage you to review those policies.",
      },
    ],
  },
  {
    title: "Changes to This Policy",
    blocks: [
      {
        kind: "p",
        text: 'We may update this Privacy Policy from time to time. We will post the updated version with a new "Last updated" date. Continued use of the App after changes constitutes acceptance.',
      },
    ],
  },
  {
    title: "Contact Us",
    blocks: [
      {
        kind: "p",
        text: `If you have questions about this Privacy Policy or believe a user under 18 is using the App, contact us at: ${PRIVACY_CONTACT}`,
      },
    ],
  },
];

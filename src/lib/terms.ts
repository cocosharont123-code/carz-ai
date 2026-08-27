// The Terms of Service, as structured data rather than markup, so the page can
// number sections, build a progress indicator, and re-render them anywhere
// without the text being duplicated.
//
// The wording is reproduced verbatim from the copy supplied by Carzfinder LLC.
// Do not paraphrase, tighten, or "fix" anything here — this is a legal
// instrument, and the cross-references in §15 (Termination) point at the
// section numbers below by index.

export type TermsBlock =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] };

export type TermsSection = {
  title: string;
  blocks: TermsBlock[];
};

/** Bump when the text changes — a stored acceptance of an older version stops counting. */
export const TERMS_VERSION = "2026-08-27";

export const TERMS_ENTITY = "Carzfinder LLC";
export const TERMS_CONTACT_EMAIL = "carz.ai.ceo@carz-ai.com";

export const TERMS_INTRO =
  "These Terms of Service (“Terms”) are a legal agreement between you and Carzfinder LLC, a Florida limited liability company (“Carz AI,” “we,” “us,” or “our”), governing your use of the Carz AI application, the carz.dev website, and all related features and services (together, the “Service”). By creating an account, downloading the app, or using the Service in any way, you agree to these Terms. If you do not agree, do not use the Service.";

export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: "What the Service Is",
    blocks: [
      {
        kind: "p",
        text: "Carz AI is a platform where users can photograph and identify cars (“spotting”), view specs and estimated market values, participate in leaderboards, maps, and bounty events, and buy and sell vehicles through user-to-user auction listings. Carz AI is a technology platform only. We are not a car dealer, broker, auctioneer, appraiser, escrow service, or party to any vehicle transaction.",
      },
    ],
  },
  {
    title: "Eligibility",
    blocks: [
      {
        kind: "p",
        text: "You must be at least 13 years old to use the Service. If you are under 18, you may only use the Service with the consent and supervision of a parent or legal guardian, and you may not buy, sell, bid on, or list any vehicle. You must be at least 18 years old and legally able to enter binding contracts to participate in auctions or transactions of any kind. By using the Service, you represent that you meet these requirements.",
      },
    ],
  },
  {
    title: "Safe Use — Never Use While Driving",
    blocks: [
      {
        kind: "p",
        text: "Do not use the Service while operating a vehicle. This includes photographing cars, scanning, browsing, bidding, or interacting with the app in any way while driving.",
      },
      {
        kind: "ul",
        items: [
          "You agree to use the Service only when it is safe and legal to do so — for example, as a passenger, or when your vehicle is lawfully parked.",
          "You are solely responsible for complying with all traffic laws, including distracted-driving and hands-free laws in your jurisdiction.",
          "You assume all risk arising from your decision to use the Service in, near, or around vehicles or roadways.",
          "To the maximum extent permitted by law, Carz AI is not liable for any accident, injury, death, property damage, traffic violation, or other harm resulting from use of the Service while driving or in any unsafe or unlawful manner.",
        ],
      },
      { kind: "p", text: "We may suspend or terminate accounts that promote or display unsafe use." },
    ],
  },
  {
    title: "Spotting and User Content",
    blocks: [
      {
        kind: "p",
        text: "When you post photos, listings, comments, or other content (“User Content”), you keep ownership of it, but you grant Carz AI a worldwide, non-exclusive, royalty-free license to host, store, display, reproduce, and distribute that content for the purpose of operating and promoting the Service.",
      },
      { kind: "p", text: "You are solely responsible for your User Content. You agree that you will not:" },
      {
        kind: "ul",
        items: [
          "Trespass on private property, or violate any law, to photograph or spot a vehicle;",
          "Harass, stalk, or follow any person or vehicle;",
          "Post content that infringes anyone’s rights, including privacy and intellectual-property rights;",
          "Post content that is illegal, fraudulent, or misleading.",
        ],
      },
      {
        kind: "p",
        text: "We may remove any User Content or restrict any account at our discretion, with or without notice.",
      },
    ],
  },
  {
    title: "AI Features",
    blocks: [
      {
        kind: "p",
        text: "The Service uses artificial intelligence for features such as vehicle identification, spec lookups, estimated market values, listing generation, image customization, and the car assistant. AI output can be wrong. All AI-generated information is provided for informational and entertainment purposes only. It is not a professional appraisal, inspection, or advice of any kind, and you should not rely on it when making purchase, sale, or bidding decisions. Estimated values are not guarantees of price or condition.",
      },
    ],
  },
  {
    title: "Auctions and Vehicle Sales",
    blocks: [
      { kind: "h3", text: "6.1 We are a venue only" },
      {
        kind: "p",
        text: "All auctions and sales on the Service are transactions directly between the buyer and the seller. Carz AI provides the listing and bidding technology only. We do not own, possess, inspect, verify, insure, ship, or transfer title to any vehicle. Listing a vehicle is free and we take no commission on sales. We are not a party to any transaction and have no responsibility for completing it.",
      },
      { kind: "h3", text: "6.2 Seller obligations" },
      { kind: "p", text: "If you list a vehicle, you represent and warrant that:" },
      {
        kind: "ul",
        items: [
          "You are the legal owner of the vehicle or are legally authorized to sell it;",
          "The vehicle is not stolen, and is free of undisclosed liens, salvage brands, or title defects except as clearly disclosed in the listing;",
          "You will provide the vehicle’s accurate VIN and truthful, complete information about its condition, history, and title;",
          "You will complete the sale, transfer title, and comply with all applicable laws (including title-transfer, tax, and disclosure laws) if your vehicle sells.",
        ],
      },
      { kind: "h3", text: "6.3 Stolen vehicles and fraud — zero tolerance" },
      {
        kind: "p",
        text: "Listing a stolen vehicle, a vehicle you do not have the right to sell, or a fraudulent or materially misleading listing is strictly prohibited. We may (but are not obligated to) run VIN or database checks on listings, and we may remove any listing, cancel any auction, and terminate any account at any time. We reserve the right to report suspected stolen vehicles or fraud to law enforcement and to cooperate fully with any investigation, including sharing account information as permitted by law.",
      },
      {
        kind: "p",
        text: "Because we cannot inspect vehicles or guarantee any seller’s honesty, Carz AI makes no representation or warranty that any listed vehicle is lawfully owned, accurately described, or free of defects, liens, or theft records. Any screening we perform is a convenience, not a guarantee, and does not shift responsibility away from the seller or the buyer.",
      },
      { kind: "h3", text: "6.4 Buyer responsibilities" },
      {
        kind: "p",
        text: "If you bid on or buy a vehicle, you are solely responsible for your own due diligence before bidding, including verifying the VIN, title status, theft records, liens, condition, and history, and inspecting the vehicle in person where possible. All vehicles are sold by their sellers “as is” unless the seller expressly states otherwise. Bids are binding offers to buy. Payment, delivery, title transfer, registration, taxes, and fees are handled entirely between buyer and seller.",
      },
      { kind: "h3", text: "6.5 Disputes between users" },
      {
        kind: "p",
        text: "Any dispute about a transaction — including non-payment, non-delivery, misrepresentation, title problems, or stolen-vehicle claims — is between the buyer and the seller. To the maximum extent permitted by law, you release Carz AI from all claims, damages, and demands arising out of or connected to any transaction or dispute between users. If you believe a vehicle is stolen or a listing is fraudulent, report it to us and to law enforcement immediately.",
      },
    ],
  },
  {
    title: "Bounties and Events",
    blocks: [
      {
        kind: "p",
        text: "Bounty events (such as car-hunt lists) reward lawful spotting only. Chasing vehicles, trespassing, dangerous driving, or any illegal activity to claim a bounty is prohibited and disqualifying. We may modify, verify, deny, or cancel any bounty or claim at our discretion. Bounties are void where prohibited by law.",
      },
    ],
  },
  {
    title: "Membership and Payments",
    blocks: [
      {
        kind: "p",
        text: "Some features require a paid membership (“Carz+”). Membership pricing, free-trial terms, and billing periods are shown at purchase. Subscriptions renew automatically until cancelled. If you subscribed through the Apple App Store or Google Play, billing, cancellation, and refunds are handled by that store under its terms. Except where required by law or by the app store’s policies, payments are non-refundable. We may change membership pricing or features with notice; changes apply at your next renewal.",
      },
    ],
  },
  {
    title: "Prohibited Conduct",
    blocks: [
      { kind: "p", text: "You agree not to:" },
      {
        kind: "ul",
        items: [
          "Use the Service while driving, or in any unlawful or unsafe manner;",
          "List, sell, or attempt to sell any stolen vehicle or any vehicle you lack the right to sell;",
          "Engage in fraud, shill bidding, bid manipulation, or fake listings;",
          "Impersonate any person or misrepresent your affiliation;",
          "Scrape, reverse-engineer, or interfere with the Service or its security;",
          "Circumvent fees, checks, or restrictions, or use another user’s account;",
          "Use the Service to violate any law or the rights of others.",
        ],
      },
    ],
  },
  {
    title: "Intellectual Property",
    blocks: [
      {
        kind: "p",
        text: "The Service, including its software, design, branding, and content (other than User Content), is owned by Carzfinder LLC or its licensors and is protected by law. We grant you a limited, revocable, non-transferable license to use the app for personal, non-commercial use in accordance with these Terms. Vehicle makes, models, and logos shown in the Service belong to their respective manufacturers; Carz AI is not affiliated with or endorsed by any vehicle manufacturer.",
      },
    ],
  },
  {
    title: "Third-Party Services",
    blocks: [
      {
        kind: "p",
        text: "The Service may rely on or link to third-party services (such as payment processors, app stores, mapping, and data providers). We are not responsible for third-party services, their content, or their terms.",
      },
    ],
  },
  {
    title: "Disclaimer of Warranties",
    blocks: [
      {
        kind: "p",
        text: "THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, ACCURACY, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, THAT AI OUTPUT WILL BE ACCURATE, OR THAT ANY LISTING, VEHICLE, USER, OR TRANSACTION IS LEGITIMATE.",
      },
    ],
  },
  {
    title: "Limitation of Liability",
    blocks: [
      {
        kind: "p",
        text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, CARZFINDER LLC AND ITS OWNERS, MANAGERS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST DATA, PERSONAL INJURY, PROPERTY DAMAGE, OR VEHICLE-TRANSACTION LOSSES, ARISING OUT OF OR RELATING TO THE SERVICE, ANY LISTING OR TRANSACTION, OR THESE TERMS. IN ALL CASES, OUR TOTAL AGGREGATE LIABILITY WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS BEFORE THE CLAIM AROSE OR (B) USD $100. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you.",
      },
    ],
  },
  {
    title: "Indemnification",
    blocks: [
      {
        kind: "p",
        text: "You agree to indemnify, defend, and hold harmless Carzfinder LLC and its owners, managers, employees, and agents from any claims, damages, losses, and expenses (including reasonable attorneys’ fees) arising out of: (a) your use of the Service, including any use while driving; (b) your User Content or listings; (c) any transaction you enter with another user, including claims involving stolen vehicles, title defects, or misrepresentation; or (d) your violation of these Terms or any law.",
      },
    ],
  },
  {
    title: "Termination",
    blocks: [
      {
        kind: "p",
        text: "You may stop using the Service at any time. We may suspend or terminate your access at any time, with or without cause or notice, including for suspected fraud, stolen-vehicle activity, unsafe use, or violation of these Terms. Sections that by their nature should survive termination (including Sections 6, 12, 13, 14, and 16) survive.",
      },
    ],
  },
  {
    title: "Governing Law and Disputes",
    blocks: [
      {
        kind: "p",
        text: "These Terms are governed by the laws of the State of Florida, without regard to conflict-of-law rules. Before filing any claim, you agree to contact us and attempt to resolve the dispute informally for at least 30 days. Any dispute that cannot be resolved informally will be brought exclusively in the state or federal courts located in Miami-Dade County, Florida, and you consent to their jurisdiction. To the extent permitted by law, each party waives the right to a jury trial and to participate in any class action.",
      },
    ],
  },
  {
    title: "Changes to These Terms",
    blocks: [
      {
        kind: "p",
        text: "We may update these Terms from time to time. If we make material changes, we will provide notice through the Service or by other reasonable means. Continued use of the Service after changes take effect means you accept the updated Terms.",
      },
    ],
  },
  {
    title: "Contact",
    blocks: [{ kind: "p", text: `${TERMS_CONTACT_EMAIL}` }],
  },
];

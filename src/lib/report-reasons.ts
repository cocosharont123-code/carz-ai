/**
 * Why someone reported a clip.
 *
 * Its own module, with no imports, because both sides need it: the sheet in the
 * feed renders the list, and the route validates against it. The store it used
 * to live in pulls in @vercel/blob and node:crypto, and importing a string
 * array from there would have dragged both into the browser bundle.
 */
export const REPORT_REASONS = [
  "Not a car",
  "Stolen or misused footage",
  "Dangerous driving",
  "Harassment or hate",
  "Spam or a scam",
  "Something else",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function isReportReason(v: unknown): v is ReportReason {
  return typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v);
}

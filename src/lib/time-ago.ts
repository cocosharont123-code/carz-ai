/**
 * Short relative time: "just now", "5m", "3h", "2d", "4w", then a date.
 *
 * It lived in the feed's post card, which is where it was first needed and also
 * where the map ended up importing it from. The feed is gone; the map still
 * needs to say when a car was spotted, so the helper moved somewhere neither
 * feature owns.
 *
 * `now` is a parameter rather than a call so this is testable and so a list can
 * stamp every row against one instant instead of drifting across a render.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function timeAgo(ts: number, now = Date.now()): string {
  const d = Math.max(0, now - ts);
  if (d < MINUTE) return "just now";
  if (d < HOUR) return `${Math.floor(d / MINUTE)}m`;
  if (d < DAY) return `${Math.floor(d / HOUR)}h`;
  if (d < WEEK) return `${Math.floor(d / DAY)}d`;
  if (d < 30 * DAY) return `${Math.floor(d / WEEK)}w`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

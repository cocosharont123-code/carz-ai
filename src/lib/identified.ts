/**
 * Whether a scan named the car it was looking at.
 *
 * One definition, used by the leaderboard's write gate and by its read
 * filter. It was written inline in the POST handler, which was fine while it
 * was the only caller and wrong the moment the board had to hide the rows it
 * had already stored: two copies of a regex are two rules, and the one that
 * drifts is always the one you are not reading.
 *
 * The vocabulary is what the model actually produces when it cannot tell --
 * it has to fill the make and model fields, so it fills them with a word
 * meaning "I do not know", or leaves one of them empty.
 */
const UNKNOWN = /^(unknown|unidentified|unrecogni[sz]ed|not identified|unnamed|no match|n\/?a|none|\?+|-+)$/i;

/** A single field: empty, or a word meaning nothing was recognised. */
const blank = (v: string | undefined): boolean => !v || UNKNOWN.test(v.trim());

/**
 * True when both halves of the name say something.
 *
 * The joined test catches "unknown car" and "not identified vehicle" split
 * across the two fields, where neither half matches on its own.
 */
export function isIdentified(make: string | undefined, model: string | undefined): boolean {
  if (blank(make) || blank(model)) return false;
  const joined = `${make} ${model}`.trim();
  if (UNKNOWN.test(joined)) return false;
  // "Unknown SUV", "Unidentified sedan": the make is the giveaway, and a real
  // marque never starts with one of these words.
  return !/^(unknown|unidentified|unrecogni[sz]ed)\b/i.test(joined);
}

import { asteriskCensorStrategy, englishDataset, englishRecommendedTransformers, RegExpMatcher, TextCensor } from "obscenity";

/**
 * Bad-word protection. Students can type anything into the apps, so:
 *   - login names with a bad word are refused (they'd show in the header),
 *   - anything typed is shown back with bad words starred out (****),
 *   - free-text answers are saved as typed but flagged for the researcher.
 * Leaderboard nicknames come from fixed word lists, so they're always clean.
 * The matcher handles leetspeak and stretched letters ("b1tch", "fuuuck").
 */

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
const censor = new TextCensor().setStrategy(asteriskCensorStrategy());

export function hasBadWords(text: string): boolean {
  return matcher.hasMatch(text);
}

/** The text with any bad words starred out, for showing on screen. */
export function clean(text: string): string {
  return matcher.hasMatch(text) ? censor.applyTo(text, matcher.getAllMatches(text)) : text;
}

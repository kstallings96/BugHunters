import { missingLine, wrongLine } from "@/machines/classify";
import type { Category, Fix } from "@/machines/types";
import { pickWinner } from "./ai/raffle";

/**
 * Raffle Picker (bonus, unmeasured). Type names, one per line; Pick once or
 * Pick 20 times (a tally chart). Random output means it can't be scored by
 * comparing two outputs, so Busted! asks the student to TAP the part of the
 * result that looks wrong (no list of bugs to pick from, which would give
 * them away), then optionally say why in their own words.
 *
 * The app is the AI's own code (src/bonus/ai/raffle.js), which trims names
 * and skips blank lines, with one line planted by the research team:
 *   off_by_one  the last name never wins                    (planted)
 *   boundary    one name "wins" a raffle against nobody     (the AI's own)
 * Debatable: a name typed twice gets two chances (two tickets?).
 */

export const RAFFLE = {
  id: "raffle" as const,
  name: "Raffle Picker",
  icon: "🎟️",
  purpose: "Picks a winner from your list of names.",
  request: "Pick one name at random. Everyone gets the same chance.",
  fields: [{ id: "names", label: "Names" }],
  pseudocode: [
    "names = the lines you typed, without blank lines",
    'if there are no names → say "No names provided"',
    "spot = a random number from 0 to (count − 2)",
    "show names[spot]",
  ],
  /** Spots count from 0: names[0] is the first name (the code question says so). */
  fixFor(kind: Category): Fix {
    if (kind === "off_by_one")
      return wrongLine(
        3,
        "spot = a random number from 0 to (count − 1)",
        "spot = a random number from 0 to count",
        "spot = a random number from 1 to count",
        "spot = a random number from 1 to (count − 1)",
      );
    return missingLine(
      2,
      'if there are fewer than 2 names → say "Add at least 2 names."',
      'if there are more than 2 names → say "Add at least 2 names."',
      'if there are fewer than 1 name → say "Add at least 2 names."',
      "if there is 1 name → spot = 1",
    );
  },
};

/** Names the way the AI's app reads them: each line trimmed, blank lines skipped. */
export function namesOf(text: string): string[] {
  return text
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

/** One pick by the AI's app (with the planted line). */
export function buggyPick(text: string): string {
  return String(pickWinner(text));
}

export interface RaffleTry {
  n: number;
  text: string;
  mode: "one" | "twenty";
  winners: string[];
}

/** What the student tapped: a bar in the 20-pick chart, or the single winner. */
export type RaffleTap = { type: "row"; name: string } | { type: "winner" };

export type RaffleVerdict =
  | { verdict: "real"; kind: Category; message: string }
  | { verdict: "debatable"; message: string }
  | { verdict: "false_alarm"; message: string };

/** Checks what the student tapped against what this try actually showed. */
export function judgeTap(t: RaffleTry, tap: RaffleTap): RaffleVerdict {
  const names = namesOf(t.text);
  const unique = new Set(names);
  if (unique.size === 1 && t.winners.some((w) => w === names[0]))
    return { verdict: "real", kind: "boundary", message: "Yes! It picked a winner with only one name. A raffle needs at least 2. That's a Limit bug! 🎉" };
  if (tap.type === "winner") {
    if (names.length === 0) return { verdict: "false_alarm", message: "With no names, that's a fair thing to say. Keep testing!" };
    return { verdict: "false_alarm", message: "One pick can't show much. Try Pick 20 times!" };
  }
  const wins = t.winners.filter((w) => w === tap.name).length;
  if (names.filter((n) => n === tap.name).length > 1)
    return { verdict: "debatable", message: "The request doesn't say. Is a name typed twice a bug, or a fair way to give someone two tickets?" };
  if (wins === 0 && tap.name === names.at(-1) && unique.size >= 2)
    return { verdict: "real", kind: "off_by_one", message: `Yes! ${tap.name} never wins. That's an Off by one bug! 🎉` };
  if (wins === 0) return { verdict: "false_alarm", message: "That could be bad luck. Pick 20 times again and see if it happens again!" };
  return { verdict: "false_alarm", message: "Random picks wobble! Pick 20 times again and see if it changes." };
}

/** Wins per name, in list order (a name typed twice adds up under one bar). */
export function tally(text: string, winners: string[]): { name: string; wins: number }[] {
  return [...new Set(namesOf(text))].map((name) => ({ name, wins: winners.filter((w) => w === name).length }));
}

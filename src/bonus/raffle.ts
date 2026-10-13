import { missingLine } from "@/machines/classify";
import type { Category, Fix } from "@/machines/types";

/**
 * Raffle Picker (bonus, unmeasured). Type names, one per line; Pick once or
 * Pick 20 times (a tally chart). Random output means it can't be scored by
 * comparing two outputs, so Busted! asks the student what's wrong and checks
 * that claim against what the try actually showed.
 *
 * Planted bugs (the buggy pick is a classic off-by-one in random-index code):
 *   off_by_one  the last name never wins
 *   empty       a blank line is an entry, so a blank name can win
 *   zero        an empty list "picks" undefined
 *   boundary    one name wins a raffle against nobody
 * Debatable: a name typed twice gets two chances (two tickets?).
 */

export const RAFFLE = {
  id: "raffle" as const,
  name: "Raffle Picker",
  icon: "🎟️",
  purpose: "Picks a winner from your list of names.",
  request: "Pick one name at random. Everyone gets the same chance.",
  fields: [{ id: "names", label: "Names" }],
  pseudocode: ["names = the lines you typed", "spot = a random number from 0 to (count − 2)", "show names[spot]"],
  fixFor(kind: Category): Fix {
    switch (kind) {
      case "off_by_one":
        return { type: "wrong_line", line: 2 };
      case "empty":
        return missingLine(1, "names = names without the blank lines", "names = names in ABC order", "names = names + names");
      case "zero":
        return missingLine(1, 'if there are no names → say "Add some names."', 'if a name is long → say "Wow!"', "names = names backwards");
      default:
        return missingLine(1, 'if there is only 1 name → say "Add at least 2 names."', "names = names in ABC order", 'if a name has an A → say "Lucky!"');
    }
  },
};

/** Entries the way the buggy app reads them: every line, blanks included. */
export function entriesOf(text: string): string[] {
  return text.trim() === "" ? [] : text.split("\n");
}

/** The buggy pick. Never returns the last entry; an empty list gives undefined. */
export function buggyPick(entries: string[], random: () => number = Math.random): string | undefined {
  return entries[Math.floor(random() * (entries.length - 1))];
}

export type RaffleClaim = "last_never_wins" | "blank_won" | "undefined_won" | "one_name" | "duplicate" | "wobble" | "unsure";

export const CLAIMS: { id: RaffleClaim; text: string }[] = [
  { id: "last_never_wins", text: "The last name never wins" },
  { id: "wobble", text: "Someone wins too many times" },
  { id: "blank_won", text: "A blank name won" },
  { id: "undefined_won", text: 'It says "undefined"' },
  { id: "one_name", text: "It picked a winner with only one name" },
  { id: "duplicate", text: "A name is in there twice" },
  { id: "unsure", text: "I'm not sure" },
];

export interface RaffleTry {
  n: number;
  text: string;
  mode: "one" | "twenty";
  /** undefined = the app showed "undefined". */
  winners: (string | undefined)[];
}

export type RaffleVerdict =
  | { verdict: "real"; kind: Category; message: string }
  | { verdict: "debatable"; message: string }
  | { verdict: "false_alarm"; message: string };

const isBlank = (w: string | undefined) => w !== undefined && w.trim() === "";

/** Checks a student's claim against what this try actually showed. */
export function judgeClaim(t: RaffleTry, claim: RaffleClaim): RaffleVerdict {
  const entries = entriesOf(t.text);
  const names = entries.filter((e) => e.trim() !== "");
  const lastName = names.at(-1);
  switch (claim) {
    case "last_never_wins":
      if (t.mode === "one") return { verdict: "false_alarm", message: "One pick can't show that. Try Pick 20 times!" };
      if (names.length >= 2 && !t.winners.includes(lastName))
        return { verdict: "real", kind: "off_by_one", message: `Yes! ${lastName} never wins. That's an Off by one bug! 🎉` };
      return { verdict: "false_alarm", message: "The last name won this time. Look again!" };
    case "blank_won":
      return t.winners.some(isBlank)
        ? { verdict: "real", kind: "empty", message: "Yes! A blank line counted as a name. That's a Blank bug! 🎉" }
        : { verdict: "false_alarm", message: "No blank name won this time. Look again!" };
    case "undefined_won":
      return t.winners.some((w) => w === undefined)
        ? { verdict: "real", kind: "zero", message: "Yes! With zero names it picked \"undefined\". That's a Zero bug! 🎉" }
        : { verdict: "false_alarm", message: 'It didn\'t say "undefined" this time. Look again!' };
    case "one_name":
      return names.length === 1 && t.winners.length > 0
        ? { verdict: "real", kind: "boundary", message: "Yes! A raffle needs at least 2 names. That's a Limit bug! 🎉" }
        : { verdict: "false_alarm", message: "There was more than one name. Look again!" };
    case "duplicate":
      return new Set(names.map((n) => n.trim().toLowerCase())).size < names.length
        ? { verdict: "debatable", message: "The request doesn't say. Is that a bug, or a fair way to give someone two tickets?" }
        : { verdict: "false_alarm", message: "No name is in there twice. Look again!" };
    case "wobble":
      return { verdict: "false_alarm", message: "Random picks wobble! Try Pick 20 times again and see if it changes." };
    default:
      return { verdict: "false_alarm", message: "That's OK! Try Pick 20 times and look closely." };
  }
}

/** Wins per entry, in list order (duplicates add up under one name). */
export function tally(entries: string[], winners: (string | undefined)[]): { name: string; wins: number }[] {
  const order = [...new Set(entries)];
  return order.map((name) => ({ name, wins: winners.filter((w) => w === name).length }));
}

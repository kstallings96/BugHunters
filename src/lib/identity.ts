import { hasBadWords } from "./clean";
/**
 * Students sign in with a first name, last initial and class period. These
 * rules are shared by the login screen and the server so both agree.
 */

export interface StudentName {
  firstName: string;
  lastInitial: string;
}

// Letters from any language, plus spaces, hyphens and apostrophes inside a
// name ("Mary Jo", "Ana-Lucía", "D'Andre").
const FIRST_NAME = /^\p{L}[\p{L}\p{M} '’-]{0,39}$/u;
const INITIAL = /^\p{L}$/u;

/** "jAYDEN" stays as typed (mixed case is deliberate: "DeShawn"); "jayden" or "JAYDEN" becomes "Jayden". */
function tidyCase(name: string): string {
  if (name !== name.toLowerCase() && name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

/** Trims, collapses spaces and fixes capitalization; null if not a usable name. */
export function normalizeName(firstName: unknown, lastInitial: unknown): StudentName | null {
  if (typeof firstName !== "string" || typeof lastInitial !== "string") return null;
  const first = firstName.normalize("NFC").trim().replace(/\s+/g, " ");
  const initial = lastInitial.normalize("NFC").trim().replace(/\.$/, "");
  if (!FIRST_NAME.test(first) || !INITIAL.test(initial)) return null;
  // Names show in the header all session: no bad words (checked here, so the server refuses them too).
  if (hasBadWords(first)) return null;
  return { firstName: tidyCase(first), lastInitial: initial.toUpperCase() };
}

/** Same person? Case-insensitive, after normalizing. */
export function sameName(a: StudentName, b: StudentName): boolean {
  return a.firstName.toLowerCase() === b.firstName.toLowerCase() && a.lastInitial.toUpperCase() === b.lastInitial.toUpperCase();
}

/** Pilot sessions: a first name starting with "Test" (any capitalization), or ?test=1. */
export function isTestName(firstName: string, testParam?: string | null): boolean {
  return /^test/i.test(firstName) || testParam === "1";
}

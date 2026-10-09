/**
 * Students sign in with a first name and last initial only. These rules are
 * shared by the name screen and the session route so both agree.
 */

export interface StudentName {
  firstName: string;
  lastInitial: string;
}

// Letters from any language, plus spaces, hyphens and apostrophes inside a
// name ("Mary Jo", "Ana-Lucía", "D'Andre").
const FIRST_NAME = /^\p{L}[\p{L}\p{M} '’-]{0,39}$/u;
const INITIAL = /^\p{L}$/u;

export function normalizeName(firstName: unknown, lastInitial: unknown): StudentName | null {
  if (typeof firstName !== "string" || typeof lastInitial !== "string") return null;
  const first = firstName.normalize("NFC").trim().replace(/\s+/g, " ");
  const initial = lastInitial.normalize("NFC").trim().replace(/\.$/, "");
  if (!FIRST_NAME.test(first) || !INITIAL.test(initial)) return null;
  return { firstName: first, lastInitial: initial.toUpperCase() };
}

/**
 * Pilot sessions are marked by a first name starting with "TEST" in capitals
 * (case-sensitive, so a child named "Tess" or "Testa" isn't caught), or by
 * the ?test=1 URL parameter.
 */
export function isTestSession(firstName: string, testParam?: string | null): boolean {
  return firstName.startsWith("TEST") || testParam === "1";
}

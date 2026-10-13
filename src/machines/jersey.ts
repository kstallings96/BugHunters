import { missingLine } from "./classify";
import type { Category, Fix, Inputs, Machine, Output } from "./types";

/**
 * Jersey Name Printer (the transfer machine: text instead of numbers).
 * Buggy: prints the name in caps with no checks, so blank prints an empty
 * jersey, spaces show up, names over 12 letters run off the jersey, and
 * numbers or emoji get printed.
 * Reference: trims; refuses blank; letters only; up to 12 letters; ALL
 * CAPS. Hyphens and apostrophes (GARCIA-LOPEZ, O'NEIL) are real name
 * formats the request doesn't mention: debatable, never a bug.
 */

export const JERSEY_MAX = 12;

const length = (t: string) => Array.from(t).length;

// Missing checks go after line 1 (after reading the name).
const FIXES: Partial<Record<Category, Fix>> = {
  empty: missingLine(1, 'if name is blank → say "Please type a last name."', "name = name backwards", 'if name is short → print "PLAYER"'),
  spaces_only: missingLine(1, 'if name is only spaces → say "Please type a last name."', "name = name + name", 'if name has an A → print "STAR"'),
  extra_spaces: missingLine(1, "name = name without spaces at the start and end", "name = name backwards", "name = name in small letters"),
  very_long: missingLine(1, `if name is longer than ${JERSEY_MAX} letters → say "Up to ${JERSEY_MAX} letters."`, "name = name backwards", 'if name is short → print "PLAYER"'),
  wrong_type: missingLine(1, 'if name has numbers or symbols → say "Names use letters only."', "name = name in small letters", "name = name + name"),
  special: missingLine(1, 'if name has numbers or symbols → say "Names use letters only."', "name = name backwards", 'if name has an A → print "STAR"'),
};

export const jersey: Machine = {
  id: "jersey",
  name: "Jersey Name Printer",
  icon: "👕",
  purpose: "Prints your last name on the back of a jersey.",
  request: `Last names in ALL CAPS, up to ${JERSEY_MAX} letters.`,
  fields: [{ id: "name", label: "Last name", kind: "text", longAt: JERSEY_MAX }],
  display: "jersey",
  buggy: ({ name }: Inputs): Output => ({ type: "result", text: name.toUpperCase() }),
  reference: ({ name }: Inputs): Output => {
    if (name === "") return { type: "not_allowed", text: "Please type a last name.", rule: "empty" };
    const t = name.trim();
    if (t === "") return { type: "not_allowed", text: "Please type a last name.", rule: "spaces_only" };
    if (/\d/.test(t)) return { type: "not_allowed", text: "Names use letters only.", rule: "wrong_type" };
    if (!/^\p{L}[\p{L}\p{M} '’-]*$/u.test(t)) return { type: "not_allowed", text: "Names use letters only.", rule: "special" };
    if (length(t) > JERSEY_MAX) return { type: "not_allowed", text: `Up to ${JERSEY_MAX} letters.`, rule: "very_long" };
    return { type: "result", text: t.toUpperCase() };
  },
  extraCategories: ({ name }) => {
    const n = length(name.trim());
    // 12 and 13 are the boundary; 11 is near it.
    return n >= JERSEY_MAX - 1 && n <= JERSEY_MAX + 1 ? ["boundary"] : [];
  },
  debatable: ({ name }) => {
    const t = name.trim();
    return /^\p{L}[\p{L}\p{M} ]*['’-][\p{L}\p{M} '’-]*$/u.test(t) && length(t) <= JERSEY_MAX;
  },
  // Both print a name, but the buggy one kept the spaces.
  resultBugKind: (_inputs, categories) => (categories.includes("extra_spaces") ? "extra_spaces" : categories[0]),
  otherAnswers: ({ name }) => [name.trim() ? name.trim().toLowerCase() : "PLAYER", "NO NAME"],
  pseudocode: ["name = what you typed", "name = name in ALL CAPS", "print name on the jersey"],
  fixFor: (kind) => FIXES[kind] ?? FIXES.empty!,
  bugs: [
    { kind: "empty", tryThis: "Leave the name empty." },
    { kind: "spaces_only", tryThis: "Type only spaces." },
    { kind: "very_long", tryThis: `Try a name with ${JERSEY_MAX + 1} letters or more.` },
    { kind: "wrong_type", tryThis: "Try a name with numbers, like SMITH2." },
    { kind: "special", tryThis: "Try an emoji or a symbol." },
    { kind: "extra_spaces", tryThis: "Put spaces before the name." },
  ],
};

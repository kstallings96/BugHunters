import { specFor } from "@/generation/specs";
import { monsterName } from "./ai/monster";
import { aiOutput, missingLine, wrongLine } from "./classify";
import type { Category, Fix, Inputs, Machine, Output } from "./types";

/**
 * Monster Namer (the transfer machine: text instead of numbers). Students
 * make up a monster's name, so nobody types their own.
 * Buggy: the AI's own code (src/machines/ai/monster.js), unchanged:
 * ALL CAPS, then the first 12 characters, no checks. So blank shows a
 * monster with no name, spaces are kept, names over 12 letters get cut
 * off without a word, and numbers or emoji get printed.
 * Reference: trims; refuses blank; letters only; up to 12 letters; ALL
 * CAPS. Hyphens and apostrophes (MEGA-BOB, GRR'AK) are name formats the
 * request doesn't mention: debatable, never a bug.
 */

export const MONSTER_MAX = 12;

const length = (t: string) => Array.from(t).length;

// Lines: 1 read, 2 caps, 3 cut to 12, 4 show. Missing checks go after line 1.
// Near misses: a check that only covers this one input ("blank" but not
// "only spaces", "numbers" but not emoji), one that would also block good
// names ("BIG BOB"), a limit off by one.
const FIXES: Partial<Record<Category, Fix>> = {
  very_long: wrongLine(
    3,
    `if name is longer than ${MONSTER_MAX} letters → say "Up to ${MONSTER_MAX} letters."`,
    `name = the first ${MONSTER_MAX + 1} letters of name`,
    `name = the last ${MONSTER_MAX} letters of name`,
  ),
  empty: missingLine(
    [1, 2, 3],
    'if name is blank → say "Please type a monster name."',
    'if name has a space in it → say "Please type a monster name."',
    'if name is longer than 0 letters → say "Please type a monster name."',
  ),
  spaces_only: missingLine(
    [1, 2, 3],
    'if name is blank or only spaces → say "Please type a monster name."',
    'if name is blank → say "Please type a monster name."',
    'if name has a space in it → say "Please type a monster name."',
  ),
  extra_spaces: missingLine(
    [1, 2],
    "name = name without spaces at the start and end",
    "name = name without any spaces",
    "name = name with one space at the start",
  ),
  wrong_type: missingLine(
    [1, 2],
    'if name has numbers or symbols → say "Names use letters only."',
    'if name is ALL numbers → say "Names use letters only."',
    'if name has letters → say "Names use letters only."',
  ),
  special: missingLine(
    [1, 2],
    'if name has numbers or symbols → say "Names use letters only."',
    'if name has numbers → say "Names use letters only."',
    'if name has letters → say "Names use letters only."',
  ),
};

export const monster: Machine = {
  id: "monster",
  name: "Monster Namer",
  icon: "👾",
  purpose: "Make up a name for your monster.",
  request: `Monster names in ALL CAPS, up to ${MONSTER_MAX} letters.`,
  prompt: specFor("monster").kidPrompt,
  fields: [{ id: "name", label: "Monster name", kind: "text", longAt: MONSTER_MAX }],
  display: "monster",
  labels: { wrong_type: "Has numbers", very_long: "Too long", special: "Symbols or emoji" },
  buggy: ({ name }: Inputs): Output => aiOutput(monsterName(name)),
  reference: ({ name }: Inputs): Output => {
    if (name === "") return { type: "not_allowed", text: "Please type a monster name.", rule: "empty" };
    const t = name.trim();
    if (t === "") return { type: "not_allowed", text: "Please type a monster name.", rule: "spaces_only" };
    if (/\d/.test(t)) return { type: "not_allowed", text: "Names use letters only.", rule: "wrong_type" };
    if (!/^\p{L}[\p{L}\p{M} '’-]*$/u.test(t)) return { type: "not_allowed", text: "Names use letters only.", rule: "special" };
    if (length(t) > MONSTER_MAX) return { type: "not_allowed", text: `Up to ${MONSTER_MAX} letters.`, rule: "very_long" };
    return { type: "result", text: t.toUpperCase() };
  },
  rulesBroken: ({ name }) => {
    const t = name.trim();
    if (t === "") return [name === "" ? "empty" : "spaces_only"];
    const broken: Category[] = [];
    if (t !== name) broken.push("extra_spaces");
    if (/\d/.test(t)) broken.push("wrong_type");
    // Symbols or emoji besides any numbers (those are counted just above).
    const rest = t.replace(/\d/g, "");
    if (rest !== "" && !/^[\p{L}\p{M} '’-]*$/u.test(rest)) broken.push("special");
    if (length(t) > MONSTER_MAX) broken.push("very_long");
    return broken;
  },
  extraCategories: ({ name }) => {
    const n = length(name.trim());
    // 12 and 13 are the boundary; 11 is near it.
    return n >= MONSTER_MAX - 1 && n <= MONSTER_MAX + 1 ? ["boundary"] : [];
  },
  debatable: ({ name }) => {
    const t = name.trim();
    return /^\p{L}[\p{L}\p{M} ]*['’-][\p{L}\p{M} '’-]*$/u.test(t) && length(t) <= MONSTER_MAX;
  },
  // Both show a name, but the buggy one kept the spaces.
  resultBugKind: (_inputs, categories) => (categories.includes("extra_spaces") ? "extra_spaces" : categories[0]),
  messages: ["Please type a monster name.", "Names use letters only.", `Up to ${MONSTER_MAX} letters.`],
  ruleMessages: {
    empty: "Please type a monster name.",
    spaces_only: "Please type a monster name.",
    wrong_type: "Names use letters only.",
    special: "Names use letters only.",
    very_long: `Up to ${MONSTER_MAX} letters.`,
  },
  otherAnswers: ({ name }) => [name.trim() ? name.trim().toLowerCase() : "MONSTER", "NO NAME"],
  pseudocode: ["name = what you typed", "name = name in ALL CAPS", `name = the first ${MONSTER_MAX} letters of name`, "show name with the monster"],
  fixFor: (kind) => FIXES[kind] ?? FIXES.empty!,
  bugs: [
    { kind: "empty", example: { name: "" }, tryThis: "Leave the name empty." },
    { kind: "spaces_only", example: { name: "   " }, tryThis: "Type only spaces." },
    { kind: "very_long", example: { name: "Fluffernutterbob" }, tryThis: `Try a name with ${MONSTER_MAX + 1} letters or more. It gets cut off.` },
    { kind: "wrong_type", example: { name: "Grizzle2" }, tryThis: "Try a name with numbers, like GRIZZLE2." },
    { kind: "special", example: { name: "Grizzle😀" }, tryThis: "Try an emoji or a symbol." },
    { kind: "extra_spaces", example: { name: "  Grizzle" }, tryThis: "Put spaces before the name." },
  ],
};

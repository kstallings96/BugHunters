import { parseNumber } from "./classify";
import type { Category, Inputs, Machine, Output } from "./types";

/**
 * Grade Checker. Buggy: uses > instead of >= (90 → B, 80 → C, 70 → D,
 * 60 → F), accepts 105 and −5, and gives F for empty or letters.
 * Reference: follows Ms. Lopez's note exactly; "not allowed" outside 0–100
 * or for non-numbers. Decimals are debatable.
 */

const CUTS: [number, string][] = [
  [90, "A"],
  [80, "B"],
  [70, "C"],
  [60, "D"],
];

export const GRADE_BOUNDARIES = [0, 60, 70, 80, 90, 100];

export const grade: Machine = {
  id: "grade",
  name: "Grade Checker",
  icon: "📝",
  purpose: "Turns a test score into a letter grade.",
  clientNote:
    "From Ms. Lopez: 90 and up is an A, 80 and up is a B, 70 and up is a C, 60 and up is a D, below 60 is an F. Scores go from 0 to 100.",
  fields: [{ id: "score", label: "Score", kind: "number" }],
  buggy: ({ score }: Inputs): Output => {
    const s = parseFloat(score);
    const letter = s > 90 ? "A" : s > 80 ? "B" : s > 70 ? "C" : s > 60 ? "D" : "F";
    return { type: "result", text: `Grade: ${letter}` };
  },
  reference: ({ score }: Inputs): Output => {
    if (score === "") return { type: "not_allowed", text: "Please type a score.", rule: "empty" };
    if (score.trim() === "") return { type: "not_allowed", text: "Please type a score.", rule: "spaces_only" };
    const s = parseNumber(score);
    if (s === null) return { type: "not_allowed", text: "That's not a score.", rule: "wrong_type" };
    if (s < 0 || s > 100) return { type: "not_allowed", text: "Scores go from 0 to 100.", rule: "out_of_range" };
    const letter = CUTS.find(([cut]) => s >= cut)?.[1] ?? "F";
    return { type: "result", text: `Grade: ${letter}` };
  },
  extraCategories: ({ score }) => {
    const s = parseNumber(score);
    if (s === null) return [];
    const cats: Category[] = [];
    if (GRADE_BOUNDARIES.includes(s)) cats.push("boundary");
    if (s < 0 || s > 100) cats.push("out_of_range");
    return cats;
  },
  debatable: ({ score }) => {
    const s = parseNumber(score);
    return s !== null && !Number.isInteger(s) && s >= 0 && s <= 100;
  },
  resultBugKind: () => "boundary",
  expectLabel: "a grade",
  pseudocode: ["if score > 90 → A", "else if score > 80 → B", "else if score > 70 → C", "else if score > 60 → D", "else → F"],
  guiltyLine: (kind, { score }) => {
    if (kind !== "boundary") return "missing";
    const line = CUTS.findIndex(([cut]) => parseNumber(score) === cut);
    return line >= 0 ? line + 1 : "missing";
  },
};

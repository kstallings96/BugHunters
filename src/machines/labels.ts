import type { Category } from "./types";

/**
 * "What kind of input broke it?": the choices students label a bug with,
 * in the order shown, and how each classifier category maps onto them.
 * label_agreement compares the student's choice with labelFor().
 */

export type StudentLabel = "zero" | "blank" | "negative" | "too_big" | "exact_limit" | "wrong_kind" | "something_else";

export const STUDENT_LABELS: { id: StudentLabel; text: string }[] = [
  { id: "zero", text: "Zero" },
  { id: "blank", text: "Blank" },
  { id: "negative", text: "Negative" },
  { id: "too_big", text: "Too big" },
  { id: "exact_limit", text: "Exactly the limit" },
  { id: "wrong_kind", text: "Wrong kind" },
  { id: "something_else", text: "Something else" },
];

const MAP: Record<Category, StudentLabel | null> = {
  normal: null,
  zero: "zero",
  empty: "blank",
  spaces_only: "blank",
  extra_spaces: "something_else",
  negative: "negative",
  huge: "too_big",
  very_long: "too_big",
  boundary: "exact_limit",
  wrong_type: "wrong_kind",
  special: "wrong_kind",
  decimal: "something_else",
  rounding: "something_else",
  off_by_one: "exact_limit",
  // Below the range reads as negative, above it as too big.
  out_of_range: null,
};

/**
 * The label a careful student would pick: from the bug kind when there is
 * one, otherwise from the input's own categories (for false alarms and
 * debatable cases). Null for an ordinary input.
 */
export function labelFor(kind: Category | null, categories: Category[]): StudentLabel | null {
  const pick = (c: Category): StudentLabel | null => (c === "out_of_range" ? (categories.includes("negative") ? "negative" : "too_big") : MAP[c]);
  if (kind) return pick(kind);
  for (const c of categories) {
    const l = pick(c);
    if (l) return l;
  }
  return null;
}

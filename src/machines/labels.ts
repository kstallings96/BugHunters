import type { Category, Machine } from "./types";

/**
 * "What kind of input broke it?": the choices students label a bug with,
 * in the order shown, and how each classifier category maps onto them.
 * Number apps and the name app get their own lists ("Not a number" vs
 * "Has numbers"). label_agreement compares the student's choice with labelFor().
 */

export type StudentLabel =
  | "zero"
  | "blank"
  | "negative"
  | "too_big"
  | "exact_limit"
  | "not_a_number"
  | "has_numbers"
  | "symbols"
  | "something_else";

const NUMBER_LABELS: { id: StudentLabel; text: string }[] = [
  { id: "zero", text: "Zero" },
  { id: "blank", text: "Blank" },
  { id: "negative", text: "Negative" },
  { id: "too_big", text: "Too big" },
  { id: "exact_limit", text: "Exactly the limit" },
  { id: "not_a_number", text: "Not a number" },
  { id: "symbols", text: "Symbols ($ % !)" },
  { id: "something_else", text: "Something else" },
];

const TEXT_LABELS: { id: StudentLabel; text: string }[] = [
  { id: "blank", text: "Blank" },
  { id: "too_big", text: "Too long" },
  { id: "exact_limit", text: "Exactly the limit" },
  { id: "has_numbers", text: "Has numbers" },
  { id: "symbols", text: "Symbols or emoji" },
  { id: "something_else", text: "Something else" },
];

const isText = (machine: Pick<Machine, "fields">) => machine.fields.every((f) => f.kind === "text");

/** The label choices for this machine, in the order shown. */
export function studentLabels(machine: Pick<Machine, "fields">): { id: StudentLabel; text: string }[] {
  return isText(machine) ? TEXT_LABELS : NUMBER_LABELS;
}

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
  wrong_type: "not_a_number",
  special: "symbols",
  decimal: "something_else",
  rounding: "something_else",
  off_by_one: "exact_limit",
  // Below the range reads as negative, above it as too big.
  out_of_range: null,
};

const TEXT_MAP: Partial<Record<Category, StudentLabel>> = { wrong_type: "has_numbers" };

/**
 * Every label that fairly describes this bug on this input. Usually one;
 * "2-3" is both Not a number and Symbols, so either counts.
 */
export function labelsFor(kind: Category | null, categories: Category[], machine?: Pick<Machine, "fields">): StudentLabel[] {
  const main = labelFor(kind, categories, machine);
  if (!main) return [];
  const both = (kind === "wrong_type" || kind === "special") && categories.includes("wrong_type") && categories.includes("special");
  if (both && machine && !isText(machine)) return [...new Set<StudentLabel>([main, "not_a_number", "symbols"])];
  return [main];
}

/**
 * The label a careful student would pick: from the bug kind when there is
 * one, otherwise from the input's own categories (for false alarms and
 * debatable cases). Null for an ordinary input.
 */
export function labelFor(kind: Category | null, categories: Category[], machine?: Pick<Machine, "fields">): StudentLabel | null {
  const text = machine ? isText(machine) : false;
  const pick = (c: Category): StudentLabel | null =>
    c === "out_of_range" ? (categories.includes("negative") ? "negative" : "too_big") : ((text && TEXT_MAP[c]) || MAP[c]);
  if (kind) return pick(kind);
  for (const c of categories) {
    const l = pick(c);
    if (l) return l;
  }
  return null;
}

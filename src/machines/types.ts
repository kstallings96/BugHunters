/**
 * The machine engine: small tools "an AI built", each with a buggy version
 * (what students see) and a correct reference version (used for scoring).
 * Everything here is pure, so it can be unit-tested and re-run server-side.
 */

export type MachineId = "allowance" | "pizza" | "grade" | "name" | "birthday";

/** Kinds of input. An input can have several. Also used as bug-kind names. */
export type Category =
  | "normal"
  | "zero"
  | "negative"
  | "decimal"
  | "huge"
  | "empty"
  | "spaces_only"
  | "extra_spaces"
  | "wrong_type"
  | "special"
  | "very_long"
  | "boundary"
  | "out_of_range";

/** Student-facing names, e.g. "Busted! You found a Zero bug". */
export const CATEGORY_LABEL: Record<Category, string> = {
  normal: "Normal",
  zero: "Zero",
  negative: "Negative",
  decimal: "Decimal",
  huge: "Huge number",
  empty: "Empty",
  spaces_only: "Spaces only",
  extra_spaces: "Extra spaces",
  wrong_type: "Wrong type",
  special: "Special characters",
  very_long: "Too long",
  boundary: "Boundary",
  out_of_range: "Out of range",
};

/** "a Zero bug", "an Empty bug". */
export function withArticle(label: string): string {
  return `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`;
}

export interface Field {
  id: string;
  label: string;
  kind: "number" | "text" | "select";
  options?: { value: string; label: string }[];
}

/** Raw text of every field, exactly as typed (never pre-trimmed). */
export type Inputs = Record<string, string>;

export type Output =
  | { type: "result"; text: string }
  /** The reference refuses the input; `rule` is the kind of input it refused. */
  | { type: "not_allowed"; text: string; rule: Category };

export interface Context {
  /** "Today" for date machines; the client's local date. */
  today: Date;
}

export interface Machine {
  id: MachineId;
  name: string;
  icon: string;
  /** One sentence. */
  purpose: string;
  /** One line: what the person asked the AI for. Defines what's correct. */
  request?: string;
  /** Optional note from the person who asked for the tool. */
  clientNote?: string;
  /** Optional nudge toward a kind of input (bonus machine only). */
  hint?: string;
  fields: Field[];
  /** What students see. */
  buggy: (inputs: Inputs, ctx: Context) => Output;
  /** What the tool should do. */
  reference: (inputs: Inputs, ctx: Context) => Output;
  /** Machine-specific categories (boundary, out of range), added to the generic ones. */
  extraCategories?: (inputs: Inputs, ctx: Context) => Category[];
  /** Inputs people could reasonably disagree about. */
  debatable: (inputs: Inputs, ctx: Context) => boolean;
  /**
   * Bug kind when both versions give a result but the results differ (no
   * reference rule to name it), e.g. the grade boundaries.
   */
  resultBugKind?: (inputs: Inputs, categories: Category[]) => Category;
  /**
   * Plausible outputs for "It should say…", offered beside the correct one
   * (and what the machine actually said).
   */
  otherAnswers: (inputs: Inputs) => string[];
  /** Bonus "find the guilty line". */
  pseudocode: string[];
  /** How to fix this bug: a line that's wrong, or a line that's missing. */
  fixFor: (kind: Category, inputs: Inputs) => Fix;
}

/**
 * Bonus question for one bug. Either one of the code lines is wrong (pick
 * it), or a check is missing: the code shows a gap after line `after` and
 * the student picks which of `options` belongs there.
 */
export type Fix =
  | { type: "wrong_line"; line: number }
  | { type: "missing_line"; after: number; options: string[]; answer: number };

export interface Evaluation {
  categories: Category[];
  buggy: Output;
  reference: Output;
  /** Buggy and reference differ, and the input isn't debatable. */
  revealsBug: boolean;
  bugKind: Category | null;
  debatable: boolean;
}

export type BustedVerdict = "real" | "false_alarm" | "debatable";

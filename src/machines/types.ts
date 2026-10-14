/**
 * The machine engine: small tools "an AI built", each with a buggy version
 * (what students see) and a correct reference version (used for scoring).
 * Everything here is pure, so it can be unit-tested and re-run server-side.
 */

export type MachineId = "allowance" | "savings" | "sale" | "monster";

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
  | "out_of_range"
  /** Bug kind only (never an input category): a typical input, rounded the wrong way. */
  | "rounding"
  /** Bug kind only: the bonus raffle's last name never wins. */
  | "off_by_one";

/** Student-facing names, e.g. "Busted! You found a Zero bug". */
export const CATEGORY_LABEL: Record<Category, string> = {
  normal: "Normal",
  zero: "Zero",
  negative: "Negative",
  decimal: "Decimal",
  huge: "Too big",
  empty: "Blank",
  spaces_only: "Spaces only",
  extra_spaces: "Extra spaces",
  wrong_type: "Not a number",
  special: "Symbols",
  very_long: "Too long",
  boundary: "Limit",
  out_of_range: "Out of range",
  rounding: "Rounding",
  off_by_one: "Off by one",
};

/** "a Zero bug", "an Out of range bug". */
export function withArticle(label: string): string {
  return `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`;
}

export interface Field {
  id: string;
  label: string;
  kind: "number" | "text" | "select";
  options?: { value: string; label: string }[];
  /** Text fields: more characters than this counts as "very long" (default LONG_TEXT). */
  longAt?: number;
}

/** One kind of bug a machine has, with an example for the missed-bug reveal. */
export interface KnownBug {
  kind: Category;
  /** An input that shows it (for code questions about bugs the student missed). */
  example: Inputs;
  /** "Try $0 a week." */
  tryThis: string;
}

/** Raw text of every field, exactly as typed (never pre-trimmed). */
export type Inputs = Record<string, string>;

export type Output =
  | { type: "result"; text: string }
  /** The reference refuses the input; `rule` is the kind of input it refused. */
  | { type: "not_allowed"; text: string; rule: Category }
  /** The AI's app refuses the input in its own words ("Invalid input"). Counts as refusing. */
  | { type: "message"; text: string };

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
  /** How the output is drawn: plain text, or as a name tag on a monster. */
  display?: "text" | "monster";
  /** What the student asked the AI for, word for word (the prompt the model got). */
  prompt: string;
  /** Every kind of bug this machine has, for the missed-bug reveal. */
  bugs: KnownBug[];
  /** Bug names that read better for this machine ("Has numbers" for a name). */
  labels?: Partial<Record<Category, string>>;
  fields: Field[];
  /** What students see. */
  buggy: (inputs: Inputs, ctx: Context) => Output;
  /** What the tool should do. */
  reference: (inputs: Inputs, ctx: Context) => Output;
  /**
   * Every rule this input breaks, not just the first one the reference
   * checks (a name can be too long AND have numbers). Kinds not in `bugs`
   * are ignored.
   */
  rulesBroken?: (inputs: Inputs, ctx: Context) => Category[];
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
 * Bonus code question for one bug, in two parts. Find it: which line is
 * wrong, or is a check missing? Fix it: pick the right line from `options`,
 * where the wrong ones are near misses (the wrong variable, "and" for "or",
 * a boundary off by one, a fix that only works for this one input).
 */
export type Fix =
  | { type: "wrong_line"; line: number; options: string[]; answer: number }
  | { type: "missing_line"; after: number; options: string[]; answer: number };

export interface Evaluation {
  categories: Category[];
  buggy: Output;
  reference: Output;
  /** Buggy and reference differ, and the input isn't debatable. */
  revealsBug: boolean;
  /** The bug this input shows: the first rule the correct version checks. */
  bugKind: Category | null;
  /**
   * Every kind of bug this input shows (bugKind first), when it breaks several
   * rules at once, like a 16-letter name with numbers in it. Empty if no bug.
   */
  bugKinds: Category[];
  debatable: boolean;
}

export type BustedVerdict = "real" | "false_alarm" | "debatable";

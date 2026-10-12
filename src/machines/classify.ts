import type { Category } from "./types";

/**
 * Generic input categories for one field. Machines add their own boundary
 * and out-of-range categories on top.
 */

/** At or above this (absolute value) a number counts as "huge". */
export const HUGE = 1_000_000;
/** More characters than this counts as "very long" text. */
export const LONG_TEXT = 30;

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/** Strict number parse: the whole trimmed text must be a number. */
export function parseNumber(raw: string): number | null {
  const t = raw.trim();
  return NUMBER.test(t) ? Number(t) : null;
}

function spacing(raw: string): Category[] {
  if (raw === "") return ["empty"];
  const t = raw.trim();
  if (t === "") return ["spaces_only"];
  return t !== raw ? ["extra_spaces"] : [];
}

export function classifyNumberField(raw: string): Category[] {
  const cats = spacing(raw);
  if (cats.includes("empty") || cats.includes("spaces_only")) return cats;
  const t = raw.trim();
  const n = parseNumber(raw);
  if (n === null) {
    cats.push("wrong_type");
    // Anything beyond letters, digits, signs, dots and spaces: "5!", "😀", "<b>"
    if (/[^\p{L}\d\s.+-]/u.test(t)) cats.push("special");
    if (t.length > LONG_TEXT) cats.push("very_long");
    return cats;
  }
  if (n === 0) cats.push("zero");
  if (n < 0) cats.push("negative");
  if (!Number.isInteger(n)) cats.push("decimal");
  if (Math.abs(n) >= HUGE) cats.push("huge");
  return cats;
}

export function classifyTextField(raw: string): Category[] {
  const cats = spacing(raw);
  if (cats.includes("empty") || cats.includes("spaces_only")) return cats;
  const t = raw.trim();
  if (/^\d+$/.test(t)) cats.push("wrong_type");
  else if (/[^\p{L}\p{M}\s'’-]/u.test(t)) cats.push("special");
  if (t.length > LONG_TEXT) cats.push("very_long");
  return cats;
}

/** Union of categories in a fixed order; "normal" only when nothing else applies. */
export function finalize(cats: Category[]): Category[] {
  const order: Category[] = [
    "empty",
    "spaces_only",
    "extra_spaces",
    "wrong_type",
    "special",
    "zero",
    "negative",
    "decimal",
    "huge",
    "very_long",
    "boundary",
    "out_of_range",
  ];
  const set = new Set<Category>(cats.filter((c) => c !== "normal"));
  const out = order.filter((c) => set.has(c));
  return out.length ? out : ["normal"];
}

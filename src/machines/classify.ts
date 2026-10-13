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

/** Money: a number, optionally with a leading "$" (people type "$20"). */
export function parseMoney(raw: string): number | null {
  return parseNumber(raw.trim().replace(/^\$/, ""));
}

/** Percent: a number, optionally with a trailing "%". */
export function parsePercent(raw: string): number | null {
  return parseNumber(raw.trim().replace(/%$/, ""));
}

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
  // "$20" and "25%" are numbers written with a symbol: special, not the wrong type.
  const symbol = /^\$/.test(t) || /%$/.test(t);
  if (symbol) cats.push("special");
  const n = parseNumber(t.replace(/^\$/, "").replace(/%$/, ""));
  if (n === null) {
    cats.push("wrong_type");
    // Anything beyond letters, digits, signs, dots and spaces: "5!", "😀", "<b>"
    if (!symbol && /[^\p{L}\d\s.+-]/u.test(t)) cats.push("special");
    if (t.length > LONG_TEXT) cats.push("very_long");
    return cats;
  }
  if (n === 0) cats.push("zero");
  if (n < 0) cats.push("negative");
  if (!Number.isInteger(n)) cats.push("decimal");
  if (Math.abs(n) >= HUGE) cats.push("huge");
  return cats;
}

export function classifyTextField(raw: string, longAt: number = LONG_TEXT): Category[] {
  const cats = spacing(raw);
  if (cats.includes("empty") || cats.includes("spaces_only")) return cats;
  const t = raw.trim();
  if (/^\d+$/.test(t)) cats.push("wrong_type");
  else if (/[^\p{L}\p{M}\s'’-]/u.test(t)) cats.push("special");
  if (Array.from(t).length > longAt) cats.push("very_long");
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

/** How the buggy machines print a number: NaN shows as "???" so middle schoolers can see it broke. */
export function shown(n: number): string {
  return Number.isNaN(n) ? "???" : String(n);
}

/** Small stable hash, so option order varies between questions but never between students. */
export function stableHash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return h;
}

/** A missing-line question: the right line plus two that don't fix this bug, in a stable mixed order. */
export function missingLine(after: number, answer: string, ...others: [string, string]) {
  const options = [answer, ...others];
  const shift = stableHash(answer) % 3;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  return { type: "missing_line" as const, after, options: rotated, answer: rotated.indexOf(answer) };
}

import { missingLine, parseMoney, shown } from "./classify";
import type { Category, Fix, Inputs, Machine, Output } from "./types";

/**
 * Savings Planner (number machine A or B). How many weeks to save up?
 * Buggy: price ÷ saved, rounded to the NEAREST week (not up), no checks:
 * $0/week → Infinity, negatives go through, blank or words → ???, "$20"
 * → ??? (the dollar sign), "1.2.3" → read as 1.2.
 * Reference: money may start with "$"; nothing below zero; saving $0 a
 * week can't work; weeks always round UP (the request says so).
 */

const weeks = (n: number | string) => (Number(n) === 1 ? "1 week" : `${n} weeks`);

type Money = { ok: true; n: number } | { ok: false; out: Output };

function money(raw: string, what: string): Money {
  const no = (text: string, rule: Category): Money => ({ ok: false, out: { type: "not_allowed", text, rule } });
  if (raw === "") return no(`Please type the ${what}.`, "empty");
  if (raw.trim() === "") return no(`Please type the ${what}.`, "spaces_only");
  const n = parseMoney(raw);
  if (n === null) return no("That's not a number.", "wrong_type");
  if (n < 0) return no("Money can't be below zero.", "negative");
  return { ok: true, n };
}

// Missing checks go after line 2, before the division.
const FIXES: Partial<Record<Category, Fix>> = {
  rounding: { type: "wrong_line", line: 3 },
  zero: missingLine(2, 'if saved is 0 → say "You have to save more than $0 a week."', 'if price is 0 → say "It\'s free!"', "weeks = price × saved"),
  negative: missingLine(2, 'if price or saved is below 0 → say "Money can\'t be below zero."', 'if price is over $100 → say "That\'s a lot!"', "weeks = saved ÷ price"),
  empty: missingLine(2, 'if price or saved is blank → say "Please type a number."', 'if saved is 1 → say "Slow and steady!"', "weeks = price − saved"),
  spaces_only: missingLine(2, 'if price or saved is blank → say "Please type a number."', 'if price is 0 → say "It\'s free!"', "weeks = price + saved"),
  wrong_type: missingLine(2, 'if price or saved is not a number → say "That\'s not a number."', 'if saved is 1 → say "Slow and steady!"', "weeks = price × 2"),
  special: missingLine(0, 'price = price without the "$" sign', 'price = price + "$"', 'show "$" + price'),
};

export const savings: Machine = {
  id: "savings",
  name: "Savings Planner",
  icon: "🐷",
  purpose: "Tells you how many weeks to save for something.",
  request: "How many weeks to save up? Round up to whole weeks.",
  fields: [
    { id: "price", label: "Price ($)", kind: "number" },
    { id: "saved", label: "Saved per week ($)", kind: "number" },
  ],
  buggy: ({ price, saved }: Inputs): Output => ({
    type: "result",
    text: weeks(shown(Math.round(parseFloat(price) / parseFloat(saved)))),
  }),
  reference: ({ price, saved }: Inputs): Output => {
    const p = money(price, "price");
    if (!p.ok) return p.out;
    const s = money(saved, "amount you save each week");
    if (!s.ok) return s.out;
    if (s.n === 0) return { type: "not_allowed", text: "You have to save more than $0 a week.", rule: "zero" };
    return { type: "result", text: weeks(Math.ceil(p.n / s.n)) };
  },
  extraCategories: ({ price, saved }) => {
    const p = parseMoney(price);
    const s = parseMoney(saved);
    // Boundaries: $0 a week, saving exactly the price, a $0 price.
    return s === 0 || p === 0 || (p !== null && s !== null && p === s) ? ["boundary"] : [];
  },
  debatable: () => false,
  // Both versions answer but disagree: "$20" (the buggy one can't read the
  // dollar sign) or the nearest-week rounding.
  resultBugKind: (_inputs, categories) => (categories.includes("special") ? "special" : "rounding"),
  otherAnswers: ({ price, saved }) => {
    const p = parseMoney(price);
    const s = parseMoney(saved);
    if (p !== null && s !== null && s > 0 && p >= 0) return [weeks(Math.floor(p / s)), weeks(Math.ceil(p / s) + 1)];
    return [weeks(0), weeks(1)];
  },
  pseudocode: ["price = the price", "saved = saved per week", "weeks = price ÷ saved, rounded to the nearest week", 'show weeks + " weeks"'],
  fixFor: (kind) => FIXES[kind] ?? FIXES.wrong_type!,
  bugs: [
    { kind: "zero", tryThis: "Try saving $0 a week." },
    { kind: "negative", tryThis: "Try a price below zero." },
    { kind: "empty", tryThis: "Leave a box empty." },
    { kind: "wrong_type", tryThis: "Type a word instead of a number." },
    { kind: "special", tryThis: "Type the price with a dollar sign, like $20." },
    { kind: "rounding", tryThis: "Try $10 with $3 a week. That needs 4 weeks." },
  ],
};

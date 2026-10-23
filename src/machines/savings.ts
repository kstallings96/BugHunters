import { specFor } from "@/generation/specs";
import { weeksToSave } from "./ai/savings";
import { aiOutput, missingLine, parseMoney, symbolAfterNumber, wrongLine } from "./classify";
import type { Category, Fix, Inputs, Machine, Output } from "./types";

/**
 * Savings Planner (number machine A or B). How many weeks to save up?
 * Buggy: the AI's own code (src/machines/ai/savings.js) with two lines
 * planted by the research team (it handled both correctly):
 *   zero      saving $0 a week → "Infinity weeks"           (planted)
 *   rounding  rounds to the NEAREST week, not up            (planted)
 * and the AI's own bugs: a negative price goes through, and parseFloat
 * reads "1.2.3" as 1.2 and "20abc" as 20. Blank, words, negative savings
 * and "$20" get its "Invalid input" message.
 * Reference: money may start with "$"; nothing below zero; saving $0 a
 * week can't work; weeks always round UP (the request says so).
 * Debatable: "$20", which it refuses. The request doesn't say whether a
 * dollar sign is OK.
 */

const weeks = (n: number | string) => (Number(n) === 1 ? "1 week" : `${n} weeks`);

type Money = { ok: true; n: number } | { ok: false; out: Output };

function money(raw: string, what: string): Money {
  const no = (text: string, rule: Category): Money => ({ ok: false, out: { type: "not_allowed", text, rule } });
  if (raw === "") return no(`You left the ${what} blank.`, "empty");
  if (raw.trim() === "") return no(`You left the ${what} blank.`, "spaces_only");
  const n = parseMoney(raw);
  if (n === null && symbolAfterNumber(raw)) return no("Type just the number, no symbols.", "special");
  if (n === null) return no("That's not a number.", "wrong_type");
  if (n < 0) return no("Money can't be below zero.", "negative");
  return { ok: true, n };
}

// Lines: 1 read price, 2 read saved, 3 the check, 4 divide and round, 5 show.
// Near misses: the wrong box, a boundary one off, rounding the other way.
const FIXES: Partial<Record<Category, Fix>> = {
  zero: wrongLine(
    3,
    'if a box has no number, or saved is 0 or below → say "Invalid input"',
    'if a box has no number, or price is 0 or below → say "Invalid input"',
    'if a box has no number, or saved is above 0 → say "Invalid input"',
  ),
  rounding: wrongLine(
    4,
    "weeks = price ÷ saved, rounded UP to a whole week",
    "weeks = price ÷ saved, rounded DOWN to a whole week",
    "weeks = saved ÷ price, rounded UP to a whole week",
  ),
  negative: missingLine(
    [1, 2, 3],
    'if price is below 0 → say "Invalid input"',
    'if saved is below 0 → say "Invalid input"',
    'if price is above 0 → say "Invalid input"',
  ),
};

/** "1.2.3" gets read as 1.2: the line that reads that box should take the number only if it's ALL a number. */
function misread(line: number, box: string): Fix {
  return wrongLine(
    line,
    `${box} = what you typed, only if ALL of it is a number`,
    `${box} = the last number in what you typed`,
    `${box} = the first digit of what you typed`,
  );
}

export const savings: Machine = {
  id: "savings",
  name: "Savings Planner",
  icon: "🐷",
  purpose: "Tells you how many weeks to save for something.",
  request: "How many weeks to save up? Round up to whole weeks.",
  prompt: specFor("savings").kidPrompt,
  fields: [
    { id: "price", label: "Price ($)", kind: "number" },
    { id: "saved", label: "Saved per week ($)", kind: "number" },
  ],
  buggy: ({ price, saved }: Inputs): Output => aiOutput(weeksToSave(price, saved), ["Invalid input"]),
  reference: ({ price, saved }: Inputs): Output => {
    const p = money(price, "price");
    if (!p.ok) return p.out;
    const s = money(saved, "amount saved");
    if (!s.ok) return s.out;
    if (s.n === 0) return { type: "not_allowed", text: "You have to save more than $0 a week.", rule: "zero" };
    return { type: "result", text: weeks(Math.ceil(p.n / s.n)) };
  },
  rulesBroken: ({ price, saved }) => {
    const broken: Category[] = [];
    for (const [raw, what] of [[price, "price"], [saved, "amount saved"]]) {
      const m = money(raw, what);
      if (!m.ok) broken.push((m.out as { rule: Category }).rule);
    }
    if (parseMoney(saved) === 0) broken.push("zero");
    return broken;
  },
  extraCategories: ({ price, saved }) => {
    const p = parseMoney(price);
    const s = parseMoney(saved);
    // Boundaries: $0 a week, saving exactly the price, a $0 price.
    return s === 0 || p === 0 || (p !== null && s !== null && p === s) ? ["boundary"] : [];
  },
  // "$20" is debatable because this app refuses it (see writesDollar in index.ts).
  debatable: () => false,
  // Both versions answer but disagree: the nearest-week rounding.
  resultBugKind: (_inputs, categories) => (categories.includes("wrong_type") ? "wrong_type" : "rounding"),
  messages: ["You left the price blank.", "You left the amount saved blank.", "That's not a number.", "Type just the number, no symbols.", "Money can't be below zero.", "You have to save more than $0 a week."],
  goodInputs: { price: "20", saved: "5" },
  otherAnswers: ({ price, saved }) => {
    const p = parseMoney(price);
    const s = parseMoney(saved);
    if (p !== null && s !== null && s > 0 && p >= 0) return [weeks(Math.floor(p / s)), weeks(Math.ceil(p / s) + 1)];
    return [weeks(0), weeks(1)];
  },
  pseudocode: [
    "price = the first number in what you typed",
    "saved = the first number in what you typed",
    'if a box has no number, or saved is below 0 → say "Invalid input"',
    "weeks = price ÷ saved, rounded to the nearest week",
    'show weeks + " weeks"',
  ],
  fixFor: (kind, inputs) => {
    // "1.2.3" gets read as 1.2, "4%" as 4: the guilty line reads that box.
    if (kind === "wrong_type" || kind === "special") return money(inputs.price ?? "", "price").ok ? misread(2, "saved") : misread(1, "price");
    return FIXES[kind] ?? FIXES.negative!;
  },
  bugs: [
    { kind: "zero", example: { price: "20", saved: "0" }, tryThis: "Try saving $0 a week." },
    { kind: "negative", example: { price: "-20", saved: "5" }, tryThis: "Try a price below zero." },
    { kind: "wrong_type", example: { price: "1.2.3", saved: "1" }, tryThis: "Try a price that isn't quite a number, like 1.2.3 or 20abc." },
    { kind: "rounding", example: { price: "10", saved: "3" }, tryThis: "Try $10 with $3 a week. That needs 4 weeks." },
    { kind: "special", example: { price: "20%", saved: "5" }, tryThis: "Put a symbol after the price, like 20% or 20$. It ignores it." },
  ],
};

import { missingLine, parseMoney, parsePercent, shown } from "./classify";
import type { Category, Fix, Inputs, Machine, Output } from "./types";

/**
 * Sale Price (number machine A or B). Price minus a percent off.
 * Buggy: no checks, so 150% off gives a negative price, -20% off raises
 * the price, a negative price goes through, blank or words → ???, and
 * "$50" → ??? (the dollar sign). "20%" works (the % is fine).
 * Reference: money may start with "$", percent may end with "%"; prices
 * can't be below zero; discounts go from 0% to 100% (the request).
 */

const cents = (n: number) => shown(Math.round(n * 100) / 100);
const salePrice = (n: number) => `Sale price: $${cents(n)}`;

const FIXES: Partial<Record<Category, Fix>> = {
  out_of_range: missingLine(2, 'if off is below 0% or above 100% → say "Discounts go from 0% to 100%."', 'if off is 50% → say "Half off!"', "sale = price + off"),
  negative: missingLine(2, 'if price is below 0 → say "Prices can\'t be below zero."', 'if off is 50% → say "Half off!"', "sale = off − price"),
  empty: missingLine(2, 'if price or off is blank → say "Please type a number."', 'if price is over $100 → say "Big sale!"', "sale = price × off"),
  spaces_only: missingLine(2, 'if price or off is blank → say "Please type a number."', 'if off is 50% → say "Half off!"', "sale = price ÷ off"),
  wrong_type: missingLine(2, 'if price or off is not a number → say "That\'s not a number."', 'if price is over $100 → say "Big sale!"', "sale = price − off"),
  special: missingLine(0, 'price = price without the "$" sign', 'price = price + "$"', 'show "$" + price'),
};

type Num = { ok: true; n: number } | { ok: false; out: Output };

function read(raw: string, what: string, parse: (s: string) => number | null): Num {
  const no = (text: string, rule: Category): Num => ({ ok: false, out: { type: "not_allowed", text, rule } });
  if (raw === "") return no(`Please type the ${what}.`, "empty");
  if (raw.trim() === "") return no(`Please type the ${what}.`, "spaces_only");
  const n = parse(raw);
  return n === null ? no("That's not a number.", "wrong_type") : { ok: true, n };
}

export const sale: Machine = {
  id: "sale",
  name: "Sale Price",
  icon: "🏷️",
  purpose: "Tells you the price after a discount.",
  request: "Discounts go from 0% to 100%.",
  fields: [
    { id: "price", label: "Price ($)", kind: "number" },
    { id: "off", label: "% off", kind: "number" },
  ],
  buggy: ({ price, off }: Inputs): Output => {
    const p = parseFloat(price);
    const o = parseFloat(off);
    return { type: "result", text: salePrice(p - (p * o) / 100) };
  },
  reference: ({ price, off }: Inputs): Output => {
    const p = read(price, "price", parseMoney);
    if (!p.ok) return p.out;
    if (p.n < 0) return { type: "not_allowed", text: "Prices can't be below zero.", rule: "negative" };
    const o = read(off, "% off", parsePercent);
    if (!o.ok) return o.out;
    if (o.n < 0 || o.n > 100) return { type: "not_allowed", text: "Discounts go from 0% to 100%.", rule: "out_of_range" };
    return { type: "result", text: salePrice(p.n - (p.n * o.n) / 100) };
  },
  extraCategories: ({ off }) => {
    const o = parsePercent(off);
    if (o === null) return [];
    if (o === 0 || o === 100) return ["boundary"];
    return o < 0 || o > 100 ? ["out_of_range"] : [];
  },
  debatable: () => false,
  // Both versions answer but disagree: the buggy one can't read "$40".
  resultBugKind: (_inputs, categories) => (categories.includes("special") ? "special" : categories[0]),
  otherAnswers: ({ price }) => {
    const p = parseMoney(price);
    return [salePrice(0), p !== null && p > 0 ? salePrice(p) : "Sale price: $10"];
  },
  pseudocode: ["price = the price", "off = the % off", "sale = price − price × off ÷ 100", 'show "Sale price: $" + sale'],
  fixFor: (kind) => FIXES[kind] ?? FIXES.wrong_type!,
  bugs: [
    { kind: "out_of_range", tryThis: "Try more than 100% off, like 150%. Or try -20%." },
    { kind: "negative", tryThis: "Try a price below zero." },
    { kind: "empty", tryThis: "Leave a box empty." },
    { kind: "wrong_type", tryThis: "Type a word instead of a number." },
    { kind: "special", tryThis: "Type the price with a dollar sign, like $50." },
  ],
};

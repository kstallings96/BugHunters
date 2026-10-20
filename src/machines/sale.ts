import { specFor } from "@/generation/specs";
import { salePrice as aiSalePrice } from "./ai/sale";
import { aiOutput, classifyNumberField, missingLine, parseMoney, parsePercent, wrongLine } from "./classify";
import type { Category, Fix, Inputs, Machine, Output } from "./types";

/**
 * Sale Price (number machine A or B). Price minus a percent off.
 * Buggy: the AI's own code (src/machines/ai/sale.js), unchanged. No checks,
 * so 150% off gives a negative price, -20% off raises the price, a
 * negative price goes through, blank or words → $???, "$40" → $??? (the
 * dollar sign), and parseFloat reads "1.2.3" as 1.2. "20%" works.
 * Reference: money may start with "$", percent may end with "%"; prices
 * can't be below zero; discounts go from 0% to 100% (the request). Same
 * formula and two decimals as the AI's, so ordinary answers match exactly.
 */

const salePrice = (p: number, off: number) => `Sale price: $${(p - p * (off / 100)).toFixed(2)}`;

// Lines: 1 read price, 2 read off, 3 compute, 4 show.
// Near misses: "and" for "or", the wrong box, a check that only covers this one input.
const FIXES: Partial<Record<Category, Fix>> = {
  out_of_range: missingLine(
    [2, 3],
    'if off is below 0% or above 100% → say "Discounts go from 0% to 100%."',
    'if off is above 0% or below 100% → say "Discounts go from 0% to 100%."',
    'if price is below 0 or above 100 → say "Discounts go from 0% to 100%."',
  ),
  negative: missingLine(
    [1, 2, 3],
    'if price is below 0 → say "Prices can\'t be below zero."',
    'if off is below 0 → say "Prices can\'t be below zero."',
    'if price is 0 → say "Prices can\'t be below zero."',
  ),
  empty: missingLine(
    [2, 3],
    'if price or off is blank → say "Please type a number."',
    'if price or off is 0 → say "Please type a number."',
    "if price or off is blank → sale = 0",
  ),
  spaces_only: missingLine(
    [2, 3],
    'if price or off is blank or only spaces → say "Please type a number."',
    'if price or off is blank → say "Please type a number."',
    'if price or off has a space in it → say "Please type a number."',
  ),
  wrong_type: missingLine(
    [2, 3],
    'if price or off is not a number → say "That\'s not a number."',
    'if price or off is a number → say "That\'s not a number."',
    'if price or off is a word → say "That\'s not a number."',
  ),
  special: wrongLine(
    1,
    'price = the number in what you typed, after a "$" if there is one',
    'price = "$" + the first number in what you typed',
    "price = what you typed, without any numbers",
  ),
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
  prompt: specFor("sale").kidPrompt,
  fields: [
    { id: "price", label: "Price ($)", kind: "number" },
    { id: "off", label: "% off", kind: "number" },
  ],
  buggy: ({ price, off }: Inputs): Output => aiOutput(aiSalePrice(price, off)),
  reference: ({ price, off }: Inputs): Output => {
    const p = read(price, "price", parseMoney);
    if (!p.ok) return p.out;
    if (p.n < 0) return { type: "not_allowed", text: "Prices can't be below zero.", rule: "negative" };
    const o = read(off, "% off", parsePercent);
    if (!o.ok) return o.out;
    if (o.n < 0 || o.n > 100) return { type: "not_allowed", text: "Discounts go from 0% to 100%.", rule: "out_of_range" };
    return { type: "result", text: salePrice(p.n, o.n) };
  },
  rulesBroken: ({ price, off }) => {
    const broken: Category[] = [];
    const p = read(price, "price", parseMoney);
    if (!p.ok) broken.push((p.out as { rule: Category }).rule);
    else if (p.n < 0) broken.push("negative");
    // The AI's code can't read a "$" (it shows $???).
    if (p.ok && /^\s*\$/.test(price)) broken.push("special");
    const o = read(off, "% off", parsePercent);
    if (!o.ok) broken.push((o.out as { rule: Category }).rule);
    else if (o.n < 0 || o.n > 100) broken.push("out_of_range");
    return broken;
  },
  extraCategories: ({ off }) => {
    const o = parsePercent(off);
    if (o === null) return [];
    if (o === 0 || o === 100) return ["boundary"];
    return o < 0 || o > 100 ? ["out_of_range"] : [];
  },
  // "$40" is not debatable here: the app doesn't refuse it, it breaks ($???).
  debatable: () => false,
  // Both versions answer but disagree: "$40" ($???) or "1.2.3" read as 1.2.
  resultBugKind: (_inputs, categories) => (categories.includes("special") ? "special" : categories.includes("wrong_type") ? "wrong_type" : categories[0]),
  messages: ["Please type the price.", "Please type the % off.", "That's not a number.", "Prices can't be below zero.", "Discounts go from 0% to 100%."],
  goodInputs: { price: "40", off: "25" },
  otherAnswers: ({ price }) => {
    const p = parseMoney(price);
    return [salePrice(0, 0), p !== null && p > 0 ? salePrice(p, 0) : "Sale price: $10.00"];
  },
  pseudocode: [
    "price = the first number in what you typed",
    "off = the first number in what you typed",
    "sale = price − price × off ÷ 100",
    'show "Sale price: $" + sale, with 2 decimals',
  ],
  fixFor: (kind, inputs) => {
    if (kind === "wrong_type") {
      const box = classifyNumberField(inputs.price ?? "").includes("wrong_type") ? "price" : "off";
      // "1.2.3" starts like a number and gets read as 1.2: the line that reads it is guilty.
      // "half" can't be read at all: a check is missing.
      if (Number.isFinite(parseFloat(inputs[box] ?? "")))
        return wrongLine(
          box === "price" ? 1 : 2,
          `${box} = what you typed, only if ALL of it is a number`,
          `${box} = the last number in what you typed`,
          `${box} = the first digit of what you typed`,
        );
    }
    return FIXES[kind] ?? FIXES.wrong_type!;
  },
  bugs: [
    { kind: "out_of_range", example: { price: "40", off: "150" }, tryThis: "Try more than 100% off, like 150%. Or try -20%." },
    { kind: "negative", example: { price: "-40", off: "25" }, tryThis: "Try a price below zero." },
    { kind: "empty", example: { price: "", off: "25" }, tryThis: "Leave a box empty." },
    { kind: "spaces_only", example: { price: "40", off: "  " }, tryThis: "Type only spaces in a box." },
    { kind: "wrong_type", example: { price: "40", off: "half" }, tryThis: "Type a word instead of a number." },
    { kind: "special", example: { price: "$50", off: "20" }, tryThis: "Type the price with a dollar sign, like $50." },
  ],
};

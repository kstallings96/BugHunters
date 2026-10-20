import { specFor } from "@/generation/specs";
import { doubleAllowance } from "./ai/allowance";
import { aiOutput, missingLine, parseMoney, wrongLine } from "./classify";
import type { Inputs, Machine, Output } from "./types";

/**
 * Tutorial machine: Allowance Doubler. The buggy version is the AI's own
 * code (src/machines/ai/allowance.js). It deletes everything that isn't a
 * digit or a dot and then reads a number, so "cat" and blank → $???,
 * "-5" → $10 (the minus sign is deleted), "1.2.3" → $2.4.
 * Reference: a number, optionally with a leading "$"; nothing below zero.
 */
export const allowance: Machine = {
  id: "allowance",
  name: "Allowance Doubler",
  icon: "💵",
  purpose: "Type your allowance and it doubles it.",
  request: "Make an app that doubles my allowance.",
  prompt: specFor("allowance").kidPrompt,
  fields: [{ id: "allowance", label: "Allowance ($)", kind: "number" }],
  buggy: ({ allowance: a }: Inputs): Output => aiOutput(doubleAllowance(a)),
  reference: ({ allowance: a }: Inputs): Output => {
    if (a === "") return { type: "not_allowed", text: "Please type a number.", rule: "empty" };
    if (a.trim() === "") return { type: "not_allowed", text: "Please type a number.", rule: "spaces_only" };
    const n = parseMoney(a);
    if (n === null) return { type: "not_allowed", text: "That's not a number.", rule: "wrong_type" };
    if (n < 0) return { type: "not_allowed", text: "Allowance can't be below zero.", rule: "negative" };
    return { type: "result", text: `$${n * 2}` };
  },
  debatable: () => false,
  messages: ["Please type a number.", "That's not a number.", "Allowance can't be below zero."],
  otherAnswers: ({ allowance: a }) => {
    const n = parseMoney(a);
    return n === null ? ["$0", "$2"] : [`$${n}`, `$${n + 2}`];
  },
  pseudocode: ["allowance = what you typed, keeping only digits and dots", 'show "$" + allowance × 2'],
  bugs: [
    { kind: "wrong_type", example: { allowance: "cat" }, tryThis: "Type a word." },
    { kind: "empty", example: { allowance: "" }, tryThis: "Leave it empty." },
    { kind: "spaces_only", example: { allowance: "  " }, tryThis: "Type only spaces." },
    { kind: "negative", example: { allowance: "-5" }, tryThis: "Try a number below zero, like -5." },
  ],
  // The practice app never reaches the bonus code questions; these keep it complete.
  fixFor: (kind) =>
    kind === "negative"
      ? wrongLine(
          1,
          'if what you typed is below 0 → say "Allowance can\'t be below zero."',
          "allowance = what you typed, keeping only digits",
          "allowance = what you typed, keeping digits, dots and minus signs",
        )
      : missingLine(
          [1],
          'if allowance is blank or not a number → say "That\'s not a number."',
          'if allowance is blank → say "That\'s not a number."',
          'if allowance is 0 → say "That\'s not a number."',
        ),
};

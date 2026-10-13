import { missingLine, parseNumber, shown } from "./classify";
import type { Inputs, Machine, Output } from "./types";

/**
 * Tutorial machine: Allowance Doubler. Its bugs all come from never checking
 * that the input is a number ("cat" → "$???").
 */
export const allowance: Machine = {
  id: "allowance",
  name: "Allowance Doubler",
  icon: "💵",
  purpose: "Type your allowance and it doubles it.",
  request: "Make an app that doubles my allowance.",
  fields: [{ id: "allowance", label: "Allowance ($)", kind: "number" }],
  buggy: ({ allowance: a }: Inputs): Output => ({ type: "result", text: `$${shown(parseFloat(a) * 2)}` }),
  reference: ({ allowance: a }: Inputs): Output => {
    if (a === "") return { type: "not_allowed", text: "Please type a number.", rule: "empty" };
    if (a.trim() === "") return { type: "not_allowed", text: "Please type a number.", rule: "spaces_only" };
    const n = parseNumber(a);
    if (n === null) return { type: "not_allowed", text: "That's not a number.", rule: "wrong_type" };
    return { type: "result", text: `$${n * 2}` };
  },
  debatable: () => false,
  otherAnswers: ({ allowance: a }) => {
    const n = parseNumber(a);
    return n === null ? ["$0", "$2"] : [`$${n}`, `$${n + 2}`];
  },
  pseudocode: ["allowance = what you typed", 'show "$" + allowance × 2'],
  fixFor: (kind) =>
    kind === "wrong_type"
      ? missingLine(1, 'if allowance is not a number → say "That\'s not a number."', 'if allowance is 0 → say "Zero!"', "allowance = allowance + 1")
      : missingLine(1, 'if allowance is blank → say "Please type a number."', 'if allowance is big → say "Wow!"', "allowance = allowance × 3"),
};

import { parseNumber } from "./classify";
import type { Inputs, Machine, Output } from "./types";

/** Tutorial machine: doubles a number. Its only bug is not checking for numbers. */
export const doubleIt: Machine = {
  id: "double",
  name: "Double It",
  icon: "✖️",
  purpose: "Type a number and it doubles it.",
  fields: [{ id: "number", label: "Number", kind: "number" }],
  buggy: ({ number }: Inputs): Output => ({ type: "result", text: `Answer: ${parseFloat(number) * 2}` }),
  reference: ({ number }: Inputs): Output => {
    if (number === "") return { type: "not_allowed", text: "Please type a number.", rule: "empty" };
    if (number.trim() === "") return { type: "not_allowed", text: "Please type a number.", rule: "spaces_only" };
    const n = parseNumber(number);
    if (n === null) return { type: "not_allowed", text: "That's not a number.", rule: "wrong_type" };
    return { type: "result", text: `Answer: ${n * 2}` };
  },
  debatable: () => false,
  expectLabel: "a number",
  pseudocode: ["number = what you typed", 'show "Answer: " + number × 2'],
  guiltyLine: () => "missing",
};

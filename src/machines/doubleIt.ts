import { missingLine, parseNumber, shown } from "./classify";
import type { Inputs, Machine, Output } from "./types";

/** Tutorial machine: doubles a number. Its bugs all come from not checking for a number. */
export const doubleIt: Machine = {
  id: "double",
  name: "Double It",
  icon: "✖️",
  purpose: "Type a number and it doubles it.",
  fields: [{ id: "number", label: "Number", kind: "number" }],
  buggy: ({ number }: Inputs): Output => ({ type: "result", text: `Answer: ${shown(parseFloat(number) * 2)}` }),
  reference: ({ number }: Inputs): Output => {
    if (number === "") return { type: "not_allowed", text: "Please type a number.", rule: "empty" };
    if (number.trim() === "") return { type: "not_allowed", text: "Please type a number.", rule: "spaces_only" };
    const n = parseNumber(number);
    if (n === null) return { type: "not_allowed", text: "That's not a number.", rule: "wrong_type" };
    return { type: "result", text: `Answer: ${n * 2}` };
  },
  debatable: () => false,
  otherAnswers: ({ number }) => {
    const n = parseNumber(number);
    return n === null ? ["Answer: 0", "Answer: 2"] : [`Answer: ${n}`, `Answer: ${n + 2}`];
  },
  pseudocode: ["number = what you typed", 'show "Answer: " + number × 2'],
  fixFor: (kind) =>
    kind === "wrong_type"
      ? missingLine(1, 'if number is not a number → say "That\'s not a number."', 'if number is 0 → say "Zero!"', "number = number + 1")
      : missingLine(1, 'if number is blank → say "Please type a number."', 'if number is big → say "Wow!"', "number = number × 3"),
};

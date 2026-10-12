import { missingLine, parseNumber, shown } from "./classify";
import type { Category, Fix, Inputs, Machine, Output } from "./types";

/**
 * Pizza Splitter. Buggy: shows slices ÷ friends raw, so 0 friends gives
 * "Infinity", negatives and decimals go through, empty or letters give
 * "???", and 8 ÷ 3 shows a long decimal.
 * Reference: whole numbers only, slices ≥ 0, friends ≥ 1. Uneven splits are
 * debatable.
 */

type Check = { ok: true; n: number } | { ok: false; out: Output };

function wholeNumber(raw: string, what: string): Check {
  const no = (text: string, rule: Category): Check => ({ ok: false, out: { type: "not_allowed", text, rule } });
  if (raw === "") return no(`Please type the number of ${what}.`, "empty");
  if (raw.trim() === "") return no(`Please type the number of ${what}.`, "spaces_only");
  const n = parseNumber(raw);
  if (n === null) return no("That's not a number.", "wrong_type");
  if (!Number.isInteger(n)) return no("Please use whole numbers.", "decimal");
  if (n < 0) return no("Numbers can't be below zero.", "negative");
  return { ok: true, n };
}

const slices = (n: number | string) => `Each friend gets ${n} slices`;

// Missing checks go after line 2, before the division.
const FIXES: Partial<Record<Category, Fix>> = {
  zero: missingLine(2, 'if friends is 0 → say "You need at least 1 friend."', 'if slices is 0 → say "No pizza left!"', "each = slices × friends"),
  negative: missingLine(2, 'if slices or friends is below 0 → say "Numbers can\'t be below zero."', 'if slices is over 100 → say "Too much pizza!"', 'if friends is 1 → say "Eat it all!"'),
  decimal: missingLine(2, 'if slices or friends has a decimal → say "Please use whole numbers."', 'if friends is 0 → say "You need at least 1 friend."', "each = slices + friends"),
  empty: missingLine(2, 'if slices or friends is blank → say "Please type a number."', 'if slices is over 100 → say "Too much pizza!"', "each = slices − friends"),
  spaces_only: missingLine(2, 'if slices or friends is blank → say "Please type a number."', 'if friends is 1 → say "Eat it all!"', "each = friends ÷ slices"),
  wrong_type: missingLine(2, 'if slices or friends is not a number → say "That\'s not a number."', 'if slices is 0 → say "No pizza left!"', "each = slices × 2"),
};

export const pizza: Machine = {
  id: "pizza",
  name: "Pizza Splitter",
  icon: "🍕",
  purpose: "Shares pizza fairly with your friends.",
  fields: [
    { id: "slices", label: "Slices", kind: "number" },
    { id: "friends", label: "Friends", kind: "number" },
  ],
  buggy: ({ slices: s, friends: f }: Inputs): Output => ({ type: "result", text: slices(shown(parseFloat(s) / parseFloat(f))) }),
  reference: ({ slices: s, friends: f }: Inputs): Output => {
    const sc = wholeNumber(s, "slices");
    if (!sc.ok) return sc.out;
    const fc = wholeNumber(f, "friends");
    if (!fc.ok) return fc.out;
    if (fc.n === 0) return { type: "not_allowed", text: "You need at least 1 friend.", rule: "zero" };
    const each = Math.floor(sc.n / fc.n);
    const left = sc.n % fc.n;
    return { type: "result", text: left ? `${slices(each)} (${left} left over)` : slices(each) };
  },
  extraCategories: ({ friends }) => (parseNumber(friends) === 1 ? ["boundary"] : []),
  debatable: ({ slices: s, friends: f }) => {
    const sn = parseNumber(s);
    const fn = parseNumber(f);
    return sn !== null && fn !== null && Number.isInteger(sn) && Number.isInteger(fn) && sn >= 0 && fn >= 1 && sn % fn !== 0;
  },
  otherAnswers: ({ slices: s }) => [slices(0), slices(Math.max(1, Math.abs(parseNumber(s) ?? 1)))],
  pseudocode: ["slices = number of slices", "friends = number of friends", "each = slices ÷ friends", 'show "Each friend gets " + each + " slices"'],
  fixFor: (kind) => FIXES[kind] ?? FIXES.wrong_type!,
};

import { parseNumber } from "./classify";
import type { Category, Inputs, Machine, Output } from "./types";

/**
 * Pizza Splitter. Buggy: shows slices ÷ friends raw, so 0 friends gives
 * "Infinity", negatives and decimals go through, empty or letters give
 * "NaN", and 8 ÷ 3 shows a long decimal.
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

export const pizza: Machine = {
  id: "pizza",
  name: "Pizza Splitter",
  icon: "🍕",
  purpose: "Shares pizza fairly with your friends.",
  fields: [
    { id: "slices", label: "Slices", kind: "number" },
    { id: "friends", label: "Friends", kind: "number" },
  ],
  buggy: ({ slices, friends }: Inputs): Output => {
    const each = parseFloat(slices) / parseFloat(friends);
    return { type: "result", text: `Each friend gets ${each}` };
  },
  reference: ({ slices, friends }: Inputs): Output => {
    const s = wholeNumber(slices, "slices");
    if (!s.ok) return s.out;
    const f = wholeNumber(friends, "friends");
    if (!f.ok) return f.out;
    if (f.n === 0) return { type: "not_allowed", text: "You need at least 1 friend.", rule: "zero" };
    const each = Math.floor(s.n / f.n);
    const left = s.n % f.n;
    return { type: "result", text: left ? `Each friend gets ${each} (${left} left over)` : `Each friend gets ${each}` };
  },
  extraCategories: ({ friends }) => (parseNumber(friends) === 1 ? ["boundary"] : []),
  debatable: ({ slices, friends }) => {
    const s = parseNumber(slices);
    const f = parseNumber(friends);
    return s !== null && f !== null && Number.isInteger(s) && Number.isInteger(f) && s >= 0 && f >= 1 && s % f !== 0;
  },
  expectLabel: "a number",
  pseudocode: ["slices = number of slices", "friends = number of friends", "each = slices ÷ friends", 'show "Each friend gets " + each'],
  // Every pizza bug is a check that isn't there.
  guiltyLine: () => "missing",
};

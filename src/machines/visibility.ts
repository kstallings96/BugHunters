import type { Category, Inputs, MachineId } from "./types";

/**
 * Every way each app's bugs can show up: loud (the answer looks broken:
 * $???, Infinity, blank) or silent (a normal-looking wrong answer), with an
 * input that shows it. The same bug kind can be both ("half" → $??? but
 * "1.2.3" → $1.08). "Possible" counts in the export come from here;
 * tests/visibility.test.ts checks each example and that nothing is missing.
 */
export interface Showing {
  kind: Category;
  visibility: "loud" | "silent";
  example: Inputs;
}

export const SHOWINGS: Partial<Record<MachineId, Showing[]>> = {
  savings: [
    { kind: "zero", visibility: "loud", example: { price: "20", saved: "0" } },
    { kind: "rounding", visibility: "silent", example: { price: "10", saved: "3" } },
    { kind: "negative", visibility: "silent", example: { price: "-20", saved: "5" } },
    { kind: "wrong_type", visibility: "silent", example: { price: "1.2.3", saved: "1" } },
    { kind: "special", visibility: "silent", example: { price: "20%", saved: "5" } },
  ],
  sale: [
    { kind: "empty", visibility: "loud", example: { price: "", off: "25" } },
    { kind: "spaces_only", visibility: "loud", example: { price: "40", off: "  " } },
    { kind: "wrong_type", visibility: "loud", example: { price: "40", off: "half" } },
    { kind: "special", visibility: "loud", example: { price: "$40", off: "25" } },
    { kind: "out_of_range", visibility: "silent", example: { price: "40", off: "150" } },
    { kind: "negative", visibility: "silent", example: { price: "-40", off: "25" } },
    { kind: "wrong_type", visibility: "silent", example: { price: "1.2.3", off: "10" } },
    { kind: "special", visibility: "silent", example: { price: "40%", off: "25" } },
  ],
  monster: [
    { kind: "empty", visibility: "loud", example: { name: "" } },
    { kind: "spaces_only", visibility: "loud", example: { name: "   " } },
    { kind: "very_long", visibility: "silent", example: { name: "Fluffernutterbob" } },
    { kind: "wrong_type", visibility: "silent", example: { name: "Grizzle2" } },
    { kind: "special", visibility: "silent", example: { name: "Grizzle😀" } },
    { kind: "extra_spaces", visibility: "silent", example: { name: "  Grizzle" } },
  ],
};

/** How many different loud (or silent) bugs this app can show; null for apps not in the list. */
export function possibleBugs(machine: string, visibility: "loud" | "silent"): number | null {
  const list = SHOWINGS[machine as MachineId];
  return list ? list.filter((s) => s.visibility === visibility).length : null;
}

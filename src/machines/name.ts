import { LONG_TEXT } from "./classify";
import type { Category, Inputs, Machine, Output } from "./types";

/**
 * Name Greeter (the transfer machine: text instead of numbers).
 * Buggy: "Hi, " + name + "!" with no checks, so empty gives "Hi, !",
 * spaces show up, and a long name runs off the screen.
 * Reference: trims, refuses empty or spaces-only, caps the length.
 * Numbers-only and all-lowercase names are debatable.
 */
export const nameGreeter: Machine = {
  id: "name",
  name: "Name Greeter",
  icon: "👋",
  purpose: "Says hi to you!",
  fields: [{ id: "name", label: "Your name", kind: "text" }],
  buggy: ({ name }: Inputs): Output => ({ type: "result", text: `Hi, ${name}!` }),
  reference: ({ name }: Inputs): Output => {
    if (name === "") return { type: "not_allowed", text: "Please type your name.", rule: "empty" };
    const t = name.trim();
    if (t === "") return { type: "not_allowed", text: "Please type your name.", rule: "spaces_only" };
    if (t.length > LONG_TEXT) return { type: "not_allowed", text: `Names can be up to ${LONG_TEXT} letters.`, rule: "very_long" };
    return { type: "result", text: `Hi, ${t}!` };
  },
  debatable: ({ name }) => {
    const t = name.trim();
    const lettersOnly = /^[\p{L}\p{M}\s'’-]+$/u.test(t);
    return /^\d+$/.test(t) || (lettersOnly && t === t.toLowerCase() && t !== t.toUpperCase());
  },
  // Both versions answer, but the buggy one kept the spaces.
  resultBugKind: (_inputs, categories: Category[]) => (categories.includes("extra_spaces") ? "extra_spaces" : categories[0]),
  expectLabel: "a greeting",
  pseudocode: ["name = what you typed", 'show "Hi, " + name + "!"'],
  guiltyLine: () => "missing",
};

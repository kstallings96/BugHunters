import { describe, expect, it } from "vitest";
import { bugCoach } from "@/components/student/Game";
import type { Try } from "@/components/student/state";
import { evaluate, MACHINES } from "@/machines";

const tryOf = (allowance: string): Try => {
  const e = evaluate(MACHINES.allowance, { allowance }, { today: new Date() });
  return { n: 1, inputs: { allowance }, output: e.buggy, correct: e.reference.text, categories: e.categories, revealsBug: e.revealsBug, bugKind: e.bugKind, debatable: e.debatable };
};

describe("practice coach", () => {
  it("says what went wrong in the student's own try", () => {
    expect(bugCoach(tryOf("cat3"))).toBe(`That's a bug! "cat3" isn't a number, but it said $6. Tap Busted!`);
    expect(bugCoach(tryOf("cat"))).toBe(`That's a bug! "cat" isn't a number, but it said $???. Tap Busted!`);
    expect(bugCoach(tryOf(""))).toBe("That's a bug! You left it blank, but it said $???. Tap Busted!");
    expect(bugCoach(tryOf("-5"))).toBe("That's a bug! An allowance can't be below zero, but it said $10. Tap Busted!");
  });
});

import { describe, expect, it } from "vitest";
import { bugCoach } from "@/components/student/Game";
import { practiceStage, untriedKinds, type Try } from "@/components/student/state";
import { evaluate, MACHINES } from "@/machines";

const tryOf = (allowance: string): Try => {
  const e = evaluate(MACHINES.allowance, { allowance }, { today: new Date() });
  return { n: 1, inputs: { allowance }, output: e.buggy, correct: e.reference.text, categories: e.categories, revealsBug: e.revealsBug, bugKind: e.bugKind, debatable: e.debatable };
};

describe("practice coach", () => {
  it("says what went wrong in the student's own try", () => {
    expect(bugCoach(tryOf("cat3"))).toBe(`You broke it! "cat3" isn't a number. Tap Busted! to report it.`);
    expect(bugCoach(tryOf("cat"))).toBe(`You broke it! "cat" isn't a number. Tap Busted! to report it.`);
    expect(bugCoach(tryOf(""))).toBe("You broke it! You left it blank. Tap Busted! to report it.");
    expect(bugCoach(tryOf("-5"))).toBe("You broke it! An allowance can't be below zero. Tap Busted! to report it.");
  });
});

describe("practice steps", () => {
  const tries = (...inputs: string[]) => inputs.map((v, i) => ({ ...tryOf(v), n: i + 1 }));

  it("walks from a working try to a bug, then asks for a different kind", () => {
    expect(practiceStage([], [])).toBe(1);
    expect(practiceStage(tries("10"), [])).toBe(2);
    expect(practiceStage(tries("10", "cat"), [])).toBe(3);
    // Busted "cat": a word again doesn't count, blank or a negative does.
    expect(practiceStage(tries("10", "cat", "dog"), ["wrong_type"])).toBe(4);
    expect(practiceStage(tries("10", "cat", "-5"), ["wrong_type"])).toBe(5);
    expect(practiceStage(tries("10", "cat", ""), ["wrong_type"])).toBe(5);
  });

  it("treats blank and only spaces as one kind", () => {
    expect(practiceStage(tries("", "  "), ["empty"])).toBe(4);
  });

  it("suggests only the kinds not tried yet", () => {
    expect(untriedKinds(tries("10"))).toEqual(["a word", "blank", "zero", "a negative number"]);
    expect(untriedKinds(tries("10", "cat", "0"))).toEqual(["blank", "a negative number"]);
    expect(untriedKinds(tries("  ", "-5"))).toEqual(["a word", "zero"]);
  });

  it("says when it broke again", () => {
    expect(bugCoach(tryOf("-5"), true)).toBe("You broke it again! An allowance can't be below zero. Tap Busted! to report it.");
  });
});

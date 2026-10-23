import { describe, expect, it } from "vitest";
import { AI_TESTS, shownExpectation } from "@/config/aiTests";
import { evaluate, MACHINES, type MachineId } from "@/machines";
import { clean, hasBadWords, shownText } from "@/lib/clean";

describe("the AI's own tests at the reveal", () => {
  const all = Object.entries(AI_TESTS).flatMap(([id, tests]) => tests!.map((t) => [id as MachineId, t] as const));

  it.each(all)("%s %j passes on the app students see (the AI's tests all pass, yet bugs hide)", (id, t) => {
    expect(evaluate(MACHINES[id], t.inputs, { today: new Date() }).buggy.text).toBe(shownExpectation(t.expects));
  });
});

describe("bad-word protection", () => {
  it("stars out bad words, including leetspeak, and leaves names alone", () => {
    expect(hasBadWords("b1tch")).toBe(true);
    expect(clean("GRIZZLE")).toBe("GRIZZLE");
    expect(clean("SHIT")).not.toContain("SHIT");
    for (const name of ["Cassidy", "Hancock", "Dickens", "Assan", "Scunthorpe"]) expect(hasBadWords(name)).toBe(false);
  });
});

describe("how typed text is shown", () => {
  it("marks spaces at the start and end, so they can be seen", () => {
    expect(shownText("    C")).toBe("␣␣␣␣C");
    expect(shownText("C ")).toBe("C␣");
    expect(shownText("BIG BOB")).toBe("BIG BOB");
    expect(shownText("   ")).toBe("␣␣␣");
    expect(shownText("")).toBe("(blank)");
  });
});

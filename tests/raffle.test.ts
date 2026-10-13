import { describe, expect, it } from "vitest";
import { buggyPick, entriesOf, judgeClaim, RAFFLE, tally, type RaffleTry } from "@/bonus/raffle";

/** Cycles through fixed "random" numbers so picks are repeatable. */
function seq(values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

const twenty = (text: string, random = Math.random): RaffleTry => {
  const entries = entriesOf(text);
  return { n: 1, text, mode: "twenty", winners: Array.from({ length: 20 }, () => buggyPick(entries, random)) };
};

describe("Raffle Picker (bonus)", () => {
  it("reads every line, blanks included", () => {
    expect(entriesOf("Sam\n\nJay")).toEqual(["Sam", "", "Jay"]);
    expect(entriesOf("   ")).toEqual([]);
  });

  it("the last name never wins, however many times you pick", () => {
    const entries = ["Sam", "Jay", "Maria", "Leo"];
    const winners = Array.from({ length: 2000 }, () => buggyPick(entries));
    expect(winners).not.toContain("Leo");
    expect(new Set(winners)).toEqual(new Set(["Sam", "Jay", "Maria"]));
  });

  it("an empty list picks undefined; one name always wins", () => {
    expect(buggyPick([], seq([0.5]))).toBeUndefined();
    expect(buggyPick(["Sam"], seq([0.9]))).toBe("Sam");
  });

  it("checks each claim against what the try showed", () => {
    const t = twenty("Sam\nJay\nMaria\nLeo");
    expect(judgeClaim(t, "last_never_wins")).toMatchObject({ verdict: "real", kind: "off_by_one" });
    expect(judgeClaim({ ...t, mode: "one", winners: ["Sam"] }, "last_never_wins").verdict).toBe("false_alarm");
    expect(judgeClaim(t, "wobble").message).toMatch(/Random picks wobble/);
    expect(judgeClaim(t, "blank_won").verdict).toBe("false_alarm");

    const blank = twenty("Sam\n\nJay", seq([0.6]));
    expect(blank.winners[0]).toBe("");
    expect(judgeClaim(blank, "blank_won")).toMatchObject({ verdict: "real", kind: "empty" });

    const empty: RaffleTry = { n: 1, text: "", mode: "one", winners: [buggyPick([], seq([0.5]))] };
    expect(judgeClaim(empty, "undefined_won")).toMatchObject({ verdict: "real", kind: "zero" });

    const one: RaffleTry = { n: 1, text: "Sam", mode: "one", winners: ["Sam"] };
    expect(judgeClaim(one, "one_name")).toMatchObject({ verdict: "real", kind: "boundary" });

    expect(judgeClaim(twenty("Sam\nSam\nJay"), "duplicate").verdict).toBe("debatable");
    expect(judgeClaim(t, "duplicate").verdict).toBe("false_alarm");
  });

  it("tallies wins per name in list order, last name at zero", () => {
    const rows = tally(["Sam", "Jay", "Leo"], ["Sam", "Jay", "Sam"]);
    expect(rows).toEqual([
      { name: "Sam", wins: 2 },
      { name: "Jay", wins: 1 },
      { name: "Leo", wins: 0 },
    ]);
  });

  it("bonus fixes: line 2 for the off-by-one, missing lines for the rest", () => {
    expect(RAFFLE.fixFor("off_by_one")).toEqual({ type: "wrong_line", line: 2 });
    for (const kind of ["empty", "zero", "boundary"] as const) {
      const f = RAFFLE.fixFor(kind);
      expect(f.type).toBe("missing_line");
      if (f.type === "missing_line") expect(f.options).toHaveLength(3);
    }
  });
});

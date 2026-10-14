import { describe, expect, it } from "vitest";
import { buggyPick } from "@/bonus/raffle";
import { findBugs, GEN_SPECS, loadFunction, raffleBugs } from "@/generation/harness";
import { MACHINES } from "@/machines";

/** A machine's buggy or reference version as a (...strings) => string function. */
const asFn = (id: (typeof GEN_SPECS)[number], version: "buggy" | "reference") => (...a: string[]) =>
  MACHINES[id.machine][version](Object.fromEntries(id.params.map((p, i) => [p, a[i]])), { today: new Date() }).text;

describe("generation harness", () => {
  it.each(GEN_SPECS)("$machine: finds every bug in the game app (the AI code, planted lines included)", (spec) => {
    const found = new Set(findBugs(spec, asFn(spec, "buggy")).map((f) => f.bug));
    for (const b of MACHINES[spec.machine].bugs) expect(found).toContain(b.kind);
  });

  it.each(GEN_SPECS)("$machine: finds nothing wrong with the correct version", (spec) => {
    expect(findBugs(spec, asFn(spec, "reference"))).toEqual([]);
  });

  it("reads model code: a typical unchecked function is caught", () => {
    const code = "function weeksToSave(price, savedPerWeek) {\n  const w = Math.ceil(Number(price) / Number(savedPerWeek));\n  return w + ' weeks';\n}";
    const bugs = new Set(findBugs(GEN_SPECS.find((s) => s.machine === "savings")!, loadFunction(code, "weeksToSave")).map((f) => f.bug));
    expect(bugs).toContain("zero");
    expect(bugs).toContain("negative");
    expect(bugs).not.toContain("rounding");
  });

  it("raffle: flags the game raffle bugs, and not a fair picker", () => {
    expect(raffleBugs((t: string) => buggyPick(t))).toMatchObject({ lastNeverWins: true, blankCanWin: false, emptyGivesJunk: false, oneNameWins: true });
    const fair = (t: string) => {
      const names = t.split("\n").map((s) => s.trim()).filter(Boolean);
      return names.length < 2 ? "Add at least 2 names." : names[Math.floor(Math.random() * names.length)];
    };
    expect(raffleBugs(fair)).toMatchObject({ lastNeverWins: false, blankCanWin: false, emptyGivesJunk: false, oneNameWins: false });
  });

  it("a sample without the requested function is reported, not crashed on", () => {
    expect(() => loadFunction("const x = 1;", "weeksToSave")).toThrow(/no function/);
  });
});

import { describe, expect, it } from "vitest";
import { classifyNumberField, classifyTextField, finalize, HUGE, LONG_TEXT, parseNumber } from "@/machines/classify";
import { answerChoices, evaluate, MACHINES, verdictFor, type Category, type Inputs, type MachineId } from "@/machines";

// A fixed "today" so date machines are deterministic: Tuesday 14 Oct 2025 (not a leap year).
const ctx = { today: new Date(2025, 9, 14, 10, 30) };
const run = (id: MachineId, inputs: Inputs) => evaluate(MACHINES[id], inputs, ctx);

describe("number parsing", () => {
  it("accepts only whole-text numbers", () => {
    expect(parseNumber("42")).toBe(42);
    expect(parseNumber(" -3.5 ")).toBe(-3.5);
    expect(parseNumber(".5")).toBe(0.5);
    expect(parseNumber("4abc")).toBeNull();
    expect(parseNumber("1e3")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
});

describe("generic categories", () => {
  const num = (raw: string) => finalize(classifyNumberField(raw));
  const text = (raw: string) => finalize(classifyTextField(raw));

  it("number fields", () => {
    expect(num("8")).toEqual(["normal"]);
    expect(num("0")).toEqual(["zero"]);
    expect(num("-4")).toEqual(["negative"]);
    expect(num("2.5")).toEqual(["decimal"]);
    expect(num("-0.5")).toEqual(["negative", "decimal"]);
    expect(num(String(HUGE))).toEqual(["huge"]);
    expect(num("")).toEqual(["empty"]);
    expect(num("   ")).toEqual(["spaces_only"]);
    expect(num(" 8 ")).toEqual(["extra_spaces"]);
    expect(num("cat")).toEqual(["wrong_type"]);
    expect(num("5!")).toEqual(["wrong_type", "special"]);
    expect(num("$20")).toEqual(["special"]);
    expect(num("25%")).toEqual(["special"]);
    expect(num("$abc")).toEqual(["wrong_type", "special"]);
    expect(num("🍕")).toEqual(["wrong_type", "special"]);
    expect(num("9".repeat(LONG_TEXT + 1))).toEqual(["huge"]);
    expect(num("a".repeat(LONG_TEXT + 1))).toEqual(["wrong_type", "very_long"]);
  });

  it("text fields", () => {
    expect(text("Jayden")).toEqual(["normal"]);
    expect(text("Mary Jo")).toEqual(["normal"]);
    expect(text("D'Andre")).toEqual(["normal"]);
    expect(text("")).toEqual(["empty"]);
    expect(text("    ")).toEqual(["spaces_only"]);
    expect(text("  Bo")).toEqual(["extra_spaces"]);
    expect(text("123")).toEqual(["wrong_type"]);
    expect(text("Bo😀")).toEqual(["special"]);
    expect(text("<b>Bo</b>")).toEqual(["special"]);
    expect(text("a".repeat(LONG_TEXT + 1))).toEqual(["very_long"]);
  });
});

/** [inputs, categories, bug kind (null = no bug), debatable] */
type Case = [Inputs, Category[], Category | null, boolean?];

function table(id: MachineId, cases: Case[]) {
  for (const [inputs, cats, kind, debatable = false] of cases) {
    it(`${JSON.stringify(inputs)} → ${kind ?? (debatable ? "debatable" : "no bug")}`, () => {
      const e = run(id, inputs);
      expect(e.categories).toEqual(cats);
      expect(e.bugKind).toBe(kind);
      expect(e.revealsBug).toBe(kind !== null);
      expect(e.debatable).toBe(debatable);
    });
  }
}

describe("Allowance Doubler (tutorial)", () => {
  table("allowance", [
    [{ allowance: "10" }, ["normal"], null],
    [{ allowance: "cat" }, ["wrong_type"], "wrong_type"],
    [{ allowance: "" }, ["empty"], "empty"],
  ]);
  it("shows $20 for 10 and $??? (not NaN) for a word", () => {
    expect(run("allowance", { allowance: "10" }).buggy.text).toBe("$20");
    expect(run("allowance", { allowance: "cat" }).buggy.text).toBe("$???");
  });
});

describe("Savings Planner", () => {
  table("savings", [
    [{ price: "20", saved: "5" }, ["normal"], null],
    [{ price: "10", saved: "3" }, ["normal"], "rounding"],
    [{ price: "20", saved: "0" }, ["zero", "boundary"], "zero"],
    [{ price: "-20", saved: "5" }, ["negative"], "negative"],
    [{ price: "20", saved: "-5" }, ["negative"], "negative"],
    [{ price: "", saved: "5" }, ["empty"], "empty"],
    [{ price: "20", saved: "  " }, ["spaces_only"], "spaces_only"],
    [{ price: "twenty", saved: "5" }, ["wrong_type"], "wrong_type"],
    [{ price: "$20", saved: "5" }, ["special"], "special"],
    [{ price: "1.2.3", saved: "1" }, ["wrong_type"], "wrong_type"],
    [{ price: "20", saved: "20" }, ["boundary"], null],
    [{ price: "0", saved: "5" }, ["zero", "boundary"], null],
    [{ price: "12.50", saved: "2.50" }, ["decimal"], null],
  ]);
  it("rounds to the nearest week instead of up", () => {
    expect(run("savings", { price: "10", saved: "3" }).buggy.text).toBe("3 weeks");
    expect(run("savings", { price: "10", saved: "3" }).reference.text).toBe("4 weeks");
    expect(run("savings", { price: "20", saved: "0" }).buggy.text).toBe("Infinity weeks");
    expect(run("savings", { price: "", saved: "5" }).buggy.text).toBe("??? weeks");
    expect(run("savings", { price: "20", saved: "20" }).buggy.text).toBe("1 week");
  });
  it("bonus: the rounding bug is line 3; a missing $0 check is a gap", () => {
    expect(MACHINES.savings.fixFor("rounding", {})).toEqual({ type: "wrong_line", line: 3 });
    const zero = MACHINES.savings.fixFor("zero", {});
    expect(zero.type === "missing_line" && zero.options[zero.answer]).toMatch(/saved is 0/);
  });
});

describe("Sale Price", () => {
  table("sale", [
    [{ price: "40", off: "25" }, ["normal"], null],
    [{ price: "40", off: "25%" }, ["special"], null],
    [{ price: "40", off: "150" }, ["out_of_range"], "out_of_range"],
    [{ price: "40", off: "-20" }, ["negative", "out_of_range"], "out_of_range"],
    [{ price: "-40", off: "25" }, ["negative"], "negative"],
    [{ price: "", off: "25" }, ["empty"], "empty"],
    [{ price: "40", off: "half" }, ["wrong_type"], "wrong_type"],
    [{ price: "$40", off: "25" }, ["special"], "special"],
    [{ price: "40", off: "0" }, ["zero", "boundary"], null],
    [{ price: "40", off: "100" }, ["boundary"], null],
    [{ price: "19.99", off: "15" }, ["decimal"], null],
  ]);
  it("shows the planted outputs", () => {
    expect(run("sale", { price: "40", off: "150" }).buggy.text).toBe("Sale price: $-20");
    expect(run("sale", { price: "40", off: "-20" }).buggy.text).toBe("Sale price: $48");
    expect(run("sale", { price: "$40", off: "25" }).buggy.text).toBe("Sale price: $???");
    expect(run("sale", { price: "19.99", off: "15" }).reference.text).toBe("Sale price: $16.99");
  });
});

describe("Jersey Name Printer", () => {
  table("jersey", [
    [{ name: "Smith" }, ["normal"], null],
    [{ name: "smith" }, ["normal"], null],
    [{ name: "" }, ["empty"], "empty"],
    [{ name: "    " }, ["spaces_only"], "spaces_only"],
    [{ name: "  Smith" }, ["extra_spaces"], "extra_spaces"],
    [{ name: "Abcdefghijk" }, ["boundary"], null],
    [{ name: "Abcdefghijkl" }, ["boundary"], null],
    [{ name: "Abcdefghijklm" }, ["very_long", "boundary"], "very_long"],
    [{ name: "Montgomeryville" }, ["very_long"], "very_long"],
    [{ name: "23" }, ["wrong_type"], "wrong_type"],
    [{ name: "Smith2" }, ["special"], "wrong_type"],
    [{ name: "Smith😀" }, ["special"], "special"],
    [{ name: "Garcia-Lopez" }, ["boundary"], null, true],
    [{ name: "O'Neil" }, ["normal"], null, true],
  ]);
  it("prints in caps, keeps spaces, prints a blank jersey", () => {
    expect(run("jersey", { name: "smith" }).buggy.text).toBe("SMITH");
    expect(run("jersey", { name: "  Smith" }).buggy.text).toBe("  SMITH");
    expect(run("jersey", { name: "" }).buggy.text).toBe("");
    expect(run("jersey", { name: "  Smith" }).reference.text).toBe("SMITH");
  });
  it("never calls a hyphen or apostrophe a bug", () => {
    for (const name of ["Garcia-Lopez", "O'Neil", "D’Angelo"]) expect(run("jersey", { name }).revealsBug).toBe(false);
  });
});

describe("Birthday Countdown (today is Oct 14)", () => {
  table("birthday", [
    [{ month: "12", day: "25" }, ["normal"], null],
    [{ month: "10", day: "14" }, ["boundary"], "boundary"],
    [{ month: "2", day: "30" }, ["out_of_range"], "out_of_range"],
    [{ month: "4", day: "31" }, ["out_of_range"], "out_of_range"],
    [{ month: "2", day: "29" }, ["normal"], null, true],
    [{ month: "10", day: "13" }, ["normal"], null],
  ]);
  it("today says 365 days instead of Happy birthday", () => {
    expect(run("birthday", { month: "10", day: "14" }).buggy.text).toBe("365 days until your birthday!");
    expect(run("birthday", { month: "10", day: "14" }).reference.text).toBe("Happy birthday! 🎂");
  });
});

describe("busted verdicts", () => {
  it("real, false alarm, debatable", () => {
    expect(verdictFor(run("savings", { price: "20", saved: "0" }))).toBe("real");
    expect(verdictFor(run("savings", { price: "20", saved: "5" }))).toBe("false_alarm");
    expect(verdictFor(run("jersey", { name: "Garcia-Lopez" }))).toBe("debatable");
  });
});

// One input for every bug kind on every measured machine.
const BUGS: [MachineId, Inputs][] = [
  ["allowance", { allowance: "cat" }],
  ["allowance", { allowance: "" }],
  ["savings", { price: "20", saved: "0" }],
  ["savings", { price: "-20", saved: "5" }],
  ["savings", { price: "", saved: "5" }],
  ["savings", { price: "twenty", saved: "5" }],
  ["savings", { price: "$20", saved: "5" }],
  ["savings", { price: "10", saved: "3" }],
  ["sale", { price: "40", off: "150" }],
  ["sale", { price: "-40", off: "25" }],
  ["sale", { price: "", off: "25" }],
  ["sale", { price: "40", off: "half" }],
  ["sale", { price: "$40", off: "25" }],
  ["jersey", { name: "" }],
  ["jersey", { name: "    " }],
  ["jersey", { name: "Abcdefghijklm" }],
  ["jersey", { name: "23" }],
  ["jersey", { name: "Smith😀" }],
  ["jersey", { name: "  Smith" }],
  ["birthday", { month: "10", day: "14" }],
  ["birthday", { month: "2", day: "30" }],
];

describe("every machine", () => {
  it("has a name, purpose, request or note, fields, pseudocode and a bug list", () => {
    for (const m of Object.values(MACHINES)) {
      expect(m.name && m.purpose).toBeTruthy();
      expect(m.fields.length).toBeGreaterThan(0);
      expect(m.pseudocode.length).toBeGreaterThan(1);
      expect(m.bugs.length).toBeGreaterThan(0);
    }
    for (const id of ["savings", "sale", "jersey"] as MachineId[]) expect(MACHINES[id].request).toBeTruthy();
  });

  it("each bug list matches the bugs the machine really has", () => {
    for (const id of Object.keys(MACHINES) as MachineId[]) {
      const found = new Set(BUGS.filter(([m]) => m === id).map(([m, inputs]) => run(m, inputs).bugKind));
      expect(new Set(MACHINES[id].bugs.map((b) => b.kind))).toEqual(found);
    }
  });

  it.each(BUGS)("%s %j: the right answer is one of three choices", (id, inputs) => {
    const e = run(id, inputs);
    expect(e.revealsBug).toBe(true);
    const { options, correct } = answerChoices(MACHINES[id], inputs, e.buggy.text, e.reference.text);
    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(3);
    expect(options[correct]).toBe(e.reference.text);
    expect(options).toContain(e.buggy.text);
  });

  it.each(BUGS)("%s %j: the bonus fix has its answer among the choices", (id, inputs) => {
    const e = run(id, inputs);
    const fix = MACHINES[id].fixFor(e.bugKind!, inputs);
    if (fix.type === "wrong_line") {
      expect(fix.line).toBeGreaterThanOrEqual(1);
      expect(fix.line).toBeLessThanOrEqual(MACHINES[id].pseudocode.length);
    } else {
      expect(fix.options).toHaveLength(3);
      expect(new Set(fix.options).size).toBe(3);
      expect(fix.options[fix.answer]).toBeTruthy();
      expect(fix.after).toBeLessThanOrEqual(MACHINES[id].pseudocode.length);
    }
  });

  it("puts the right answer in different spots", () => {
    const spots = new Set(
      BUGS.map(([id, inputs]) => {
        const e = run(id, inputs);
        return answerChoices(MACHINES[id], inputs, e.buggy.text, e.reference.text).correct;
      }),
    );
    expect(spots.size).toBeGreaterThan(1);
  });
});

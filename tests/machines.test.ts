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

describe("Pizza Splitter", () => {
  table("pizza", [
    [{ slices: "8", friends: "4" }, ["normal"], null],
    [{ slices: "8", friends: "0" }, ["zero"], "zero"],
    [{ slices: "0", friends: "4" }, ["zero"], null],
    [{ slices: "8", friends: "-2" }, ["negative"], "negative"],
    [{ slices: "-8", friends: "2" }, ["negative"], "negative"],
    [{ slices: "7.5", friends: "3" }, ["decimal"], "decimal"],
    [{ slices: "", friends: "2" }, ["empty"], "empty"],
    [{ slices: "8", friends: "  " }, ["spaces_only"], "spaces_only"],
    [{ slices: "eight", friends: "2" }, ["wrong_type"], "wrong_type"],
    [{ slices: "8", friends: "1" }, ["boundary"], null],
    [{ slices: "2000000", friends: "2" }, ["huge"], null],
    [{ slices: " 8", friends: "2" }, ["extra_spaces"], null],
    [{ slices: "8", friends: "3" }, ["normal"], null, true],
  ]);
  it("shows the planted outputs", () => {
    expect(run("pizza", { slices: "8", friends: "0" }).buggy.text).toBe("Each friend gets Infinity slices");
    expect(run("pizza", { slices: "", friends: "2" }).buggy.text).toBe("Each friend gets ??? slices");
    expect(run("pizza", { slices: "8", friends: "3" }).buggy.text).toBe("Each friend gets 2.6666666666666665 slices");
    expect(run("pizza", { slices: "8", friends: "-2" }).buggy.text).toBe("Each friend gets -4 slices");
    expect(run("pizza", { slices: "8", friends: "4" }).reference.text).toBe("Each friend gets 2 slices");
    expect(run("pizza", { slices: "8", friends: "0" }).reference).toMatchObject({ type: "not_allowed", rule: "zero" });
  });
});

describe("Grade Checker", () => {
  table("grade", [
    [{ score: "85" }, ["normal"], null],
    [{ score: "90" }, ["boundary"], "boundary"],
    [{ score: "80" }, ["boundary"], "boundary"],
    [{ score: "70" }, ["boundary"], "boundary"],
    [{ score: "60" }, ["boundary"], "boundary"],
    [{ score: "100" }, ["boundary"], null],
    [{ score: "0" }, ["zero", "boundary"], null],
    [{ score: "105" }, ["out_of_range"], "out_of_range"],
    [{ score: "-5" }, ["negative", "out_of_range"], "out_of_range"],
    [{ score: "" }, ["empty"], "empty"],
    [{ score: "A+" }, ["wrong_type"], "wrong_type"],
    [{ score: "90%" }, ["wrong_type", "special"], "wrong_type"],
    [{ score: "ninety" }, ["wrong_type"], "wrong_type"],
    [{ score: "89.5" }, ["decimal"], null, true],
    [{ score: "1000000" }, ["huge", "out_of_range"], "out_of_range"],
  ]);
  it("uses > instead of >=", () => {
    expect(run("grade", { score: "90" }).buggy.text).toBe("Grade: B");
    expect(run("grade", { score: "90" }).reference.text).toBe("Grade: A");
    expect(run("grade", { score: "105" }).buggy.text).toBe("Grade: A");
    expect(run("grade", { score: "-5" }).buggy.text).toBe("Grade: F");
    expect(run("grade", { score: "cat" }).buggy.text).toBe("Grade: F");
  });
  it("bonus: a boundary bug is a wrong line; out of range is a missing line", () => {
    const f = MACHINES.grade.fixFor;
    expect([90, 80, 70, 60].map((s) => f("boundary", { score: String(s) }))).toEqual([1, 2, 3, 4].map((line) => ({ type: "wrong_line", line })));
    const missing = f("out_of_range", { score: "105" });
    expect(missing.type).toBe("missing_line");
    if (missing.type === "missing_line") expect(missing.options[missing.answer]).toMatch(/0 to 100/);
  });
});

describe("Name Greeter", () => {
  table("name", [
    [{ name: "Jayden" }, ["normal"], null],
    [{ name: "" }, ["empty"], "empty"],
    [{ name: "     " }, ["spaces_only"], "spaces_only"],
    [{ name: "  Jayden" }, ["extra_spaces"], "extra_spaces"],
    [{ name: "Jayden " }, ["extra_spaces"], "extra_spaces"],
    [{ name: "J".repeat(40) }, ["very_long"], "very_long"],
    [{ name: "Jay😀" }, ["special"], null],
    [{ name: "<script>alert(1)</script>" }, ["special"], null],
    [{ name: "123" }, ["wrong_type"], null, true],
    [{ name: "jayden" }, ["normal"], null, true],
  ]);
  it("shows the planted outputs", () => {
    expect(run("name", { name: "" }).buggy.text).toBe("Hi, !");
    expect(run("name", { name: "   " }).buggy.text).toBe("Hi,    !");
    expect(run("name", { name: "  Bo" }).reference.text).toBe("Hi, Bo!");
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
    expect(run("birthday", { month: "10", day: "15" }).buggy.text).toBe("1 day until your birthday!");
  });
  it("Feb 30 rolls over silently", () => {
    expect(run("birthday", { month: "2", day: "30" }).buggy.text).toMatch(/^\d+ days until your birthday!$/);
  });
  it("bonus: line 2 is wrong for the today bug", () => {
    expect(MACHINES.birthday.fixFor("boundary", {})).toEqual({ type: "wrong_line", line: 2 });
  });
  it("has a hint for the bonus", () => {
    expect(MACHINES.birthday.hint).toMatch(/doesn't exist/);
  });
});

describe("busted verdicts", () => {
  it("real, false alarm, debatable", () => {
    expect(verdictFor(run("pizza", { slices: "8", friends: "0" }))).toBe("real");
    expect(verdictFor(run("pizza", { slices: "8", friends: "4" }))).toBe("false_alarm");
    expect(verdictFor(run("pizza", { slices: "8", friends: "3" }))).toBe("debatable");
    expect(verdictFor(run("grade", { score: "89.5" }))).toBe("debatable");
  });
});

describe("every machine", () => {
  it("has a name, purpose, fields and pseudocode", () => {
    for (const m of Object.values(MACHINES)) {
      expect(m.name && m.purpose).toBeTruthy();
      expect(m.fields.length).toBeGreaterThan(0);
      expect(m.pseudocode.length).toBeGreaterThan(1);
    }
  });

  // One input for every bug kind on every machine.
  const BUGS: [MachineId, Inputs][] = [
    ["allowance", { allowance: "cat" }],
    ["allowance", { allowance: "" }],
    ["allowance", { allowance: "  " }],
    ["pizza", { slices: "8", friends: "0" }],
    ["pizza", { slices: "8", friends: "-2" }],
    ["pizza", { slices: "7.5", friends: "3" }],
    ["pizza", { slices: "", friends: "2" }],
    ["pizza", { slices: "8", friends: "  " }],
    ["pizza", { slices: "eight", friends: "2" }],
    ["grade", { score: "90" }],
    ["grade", { score: "105" }],
    ["grade", { score: "" }],
    ["grade", { score: "  " }],
    ["grade", { score: "ninety" }],
    ["name", { name: "" }],
    ["name", { name: "   " }],
    ["name", { name: "  Bo" }],
    ["name", { name: "B".repeat(40) }],
    ["birthday", { month: "10", day: "14" }],
    ["birthday", { month: "2", day: "30" }],
  ];

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

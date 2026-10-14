import { describe, expect, it } from "vitest";
import { classifyNumberField, classifyTextField, finalize, HUGE, LONG_TEXT, parseNumber } from "@/machines/classify";
import { answerChoices, bugLabel, evaluate, labelFor, MACHINES, studentLabels, verdictFor, type Category, type Inputs, type MachineId } from "@/machines";

// A fixed "today" for the evaluation context (no machine currently depends on the date).
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

describe("Allowance Doubler (tutorial, the AI's code)", () => {
  table("allowance", [
    [{ allowance: "10" }, ["normal"], null],
    [{ allowance: "$10" }, ["special"], null],
    [{ allowance: "2.5" }, ["decimal"], null],
    [{ allowance: "cat" }, ["wrong_type"], "wrong_type"],
    [{ allowance: "1.2.3" }, ["wrong_type"], "wrong_type"],
    [{ allowance: "" }, ["empty"], "empty"],
    [{ allowance: "  " }, ["spaces_only"], "spaces_only"],
    [{ allowance: "-5" }, ["negative"], "negative"],
  ]);
  it("shows $20 for 10, $??? (not NaN) for a word, and drops the minus sign", () => {
    expect(run("allowance", { allowance: "10" }).buggy.text).toBe("$20");
    expect(run("allowance", { allowance: "cat" }).buggy.text).toBe("$???");
    expect(run("allowance", { allowance: "-5" }).buggy.text).toBe("$10");
  });
});

describe("Savings Planner (the AI's code, two planted lines)", () => {
  table("savings", [
    [{ price: "20", saved: "5" }, ["normal"], null],
    [{ price: "10", saved: "3" }, ["normal"], "rounding"],
    [{ price: "20", saved: "0" }, ["zero", "boundary"], "zero"],
    [{ price: "-20", saved: "5" }, ["negative"], "negative"],
    [{ price: "1.2.3", saved: "1" }, ["wrong_type"], "wrong_type"],
    [{ price: "20abc", saved: "5" }, ["wrong_type"], "wrong_type"],
    // The AI's "Invalid input" counts as refusing, like the reference.
    [{ price: "20", saved: "-5" }, ["negative"], null],
    [{ price: "", saved: "5" }, ["empty"], null],
    [{ price: "20", saved: "  " }, ["spaces_only"], null],
    [{ price: "twenty", saved: "5" }, ["wrong_type"], null],
    // The request doesn't say whether "$20" is OK.
    [{ price: "$20", saved: "5" }, ["special"], null, true],
    [{ price: "20", saved: "20" }, ["boundary"], null],
    [{ price: "0", saved: "5" }, ["zero", "boundary"], null],
    [{ price: "12.50", saved: "2.50" }, ["decimal"], null],
  ]);
  it("rounds to the nearest week instead of up, and divides by zero", () => {
    expect(run("savings", { price: "10", saved: "3" }).buggy.text).toBe("3 weeks");
    expect(run("savings", { price: "10", saved: "3" }).reference.text).toBe("4 weeks");
    expect(run("savings", { price: "20", saved: "0" }).buggy.text).toBe("Infinity weeks");
    expect(run("savings", { price: "0", saved: "0" }).buggy.text).toBe("??? weeks");
    expect(run("savings", { price: "", saved: "5" }).buggy).toEqual({ type: "message", text: "Invalid input" });
    expect(run("savings", { price: "20", saved: "20" }).buggy.text).toBe("1 week");
  });
  it("bonus: the planted lines are lines 3 and 4; 1.2.3 is read by line 1 or 2", () => {
    expect(MACHINES.savings.fixFor("zero", {})).toEqual({ type: "wrong_line", line: 3 });
    expect(MACHINES.savings.fixFor("rounding", {})).toEqual({ type: "wrong_line", line: 4 });
    expect(MACHINES.savings.fixFor("wrong_type", { price: "1.2.3", saved: "1" })).toEqual({ type: "wrong_line", line: 1 });
    expect(MACHINES.savings.fixFor("wrong_type", { price: "20", saved: "5x" })).toEqual({ type: "wrong_line", line: 2 });
  });
});

describe("Sale Price (the AI's code)", () => {
  table("sale", [
    [{ price: "40", off: "25" }, ["normal"], null],
    [{ price: "40", off: "25%" }, ["special"], null],
    [{ price: "40", off: "150" }, ["out_of_range"], "out_of_range"],
    [{ price: "40", off: "-20" }, ["negative", "out_of_range"], "out_of_range"],
    [{ price: "-40", off: "25" }, ["negative"], "negative"],
    [{ price: "", off: "25" }, ["empty"], "empty"],
    [{ price: "40", off: "  " }, ["spaces_only"], "spaces_only"],
    [{ price: "40", off: "half" }, ["wrong_type"], "wrong_type"],
    [{ price: "1.2.3", off: "10" }, ["wrong_type"], "wrong_type"],
    // Not debatable here: the app doesn't refuse "$40", it breaks.
    [{ price: "$40", off: "25" }, ["special"], "special"],
    [{ price: "40", off: "0" }, ["zero", "boundary"], null],
    [{ price: "40", off: "100" }, ["boundary"], null],
    [{ price: "19.99", off: "15" }, ["decimal"], null],
  ]);
  it("shows the AI's outputs", () => {
    expect(run("sale", { price: "40", off: "150" }).buggy.text).toBe("Sale price: $-20.00");
    expect(run("sale", { price: "40", off: "-20" }).buggy.text).toBe("Sale price: $48.00");
    expect(run("sale", { price: "$40", off: "25" }).buggy.text).toBe("Sale price: $???");
    expect(run("sale", { price: "19.99", off: "15" }).reference.text).toBe("Sale price: $16.99");
  });
  it("bonus: a word needs a missing check; 1.2.3 is a misread line", () => {
    expect(MACHINES.sale.fixFor("wrong_type", { price: "40", off: "half" }).type).toBe("missing_line");
    expect(MACHINES.sale.fixFor("wrong_type", { price: "1.2.3", off: "10" })).toEqual({ type: "wrong_line", line: 1 });
  });
});

describe("Monster Namer (the AI's code)", () => {
  table("monster", [
    [{ name: "Grizzle" }, ["normal"], null],
    [{ name: "grizzle" }, ["normal"], null],
    [{ name: "Big Bob" }, ["normal"], null],
    [{ name: "" }, ["empty"], "empty"],
    [{ name: "    " }, ["spaces_only"], "spaces_only"],
    [{ name: "  Grizzle" }, ["extra_spaces"], "extra_spaces"],
    [{ name: "Abcdefghijk" }, ["boundary"], null],
    [{ name: "Abcdefghijkl" }, ["boundary"], null],
    [{ name: "Abcdefghijklm" }, ["very_long", "boundary"], "very_long"],
    [{ name: "Fluffernutterbob" }, ["very_long"], "very_long"],
    [{ name: "23" }, ["wrong_type"], "wrong_type"],
    [{ name: "Grizzle2" }, ["special"], "wrong_type"],
    [{ name: "Grizzle😀" }, ["special"], "special"],
    [{ name: "Mega-Bob" }, ["normal"], null, true],
    [{ name: "Grr'ak" }, ["normal"], null, true],
  ]);
  it("prints in caps, keeps spaces, cuts long names off at 12", () => {
    expect(run("monster", { name: "grizzle" }).buggy.text).toBe("GRIZZLE");
    expect(run("monster", { name: "  Grizzle" }).buggy.text).toBe("  GRIZZLE");
    expect(run("monster", { name: "" }).buggy.text).toBe("");
    expect(run("monster", { name: "Fluffernutterbob" }).buggy.text).toBe("FLUFFERNUTTE");
    expect(run("monster", { name: "  Grizzle" }).reference.text).toBe("GRIZZLE");
  });
  it("never calls a hyphen or apostrophe a bug", () => {
    for (const name of ["Mega-Bob", "Grr'ak", "Zog’mar"]) expect(run("monster", { name }).revealsBug).toBe(false);
  });
  it("names its bugs for a name app", () => {
    expect(bugLabel("monster", "wrong_type")).toBe("Has numbers");
    expect(bugLabel("savings", "wrong_type")).toBe("Not a number");
    expect(bugLabel("monster", "very_long")).toBe("Too long");
  });
});

describe("busted verdicts", () => {
  it("real, false alarm, debatable", () => {
    expect(verdictFor(run("savings", { price: "20", saved: "0" }))).toBe("real");
    expect(verdictFor(run("savings", { price: "20", saved: "5" }))).toBe("false_alarm");
    expect(verdictFor(run("monster", { name: "Mega-Bob" }))).toBe("debatable");
    expect(verdictFor(run("savings", { price: "$20", saved: "5" }))).toBe("debatable");
  });
});

// One input for every bug kind on every measured machine.
const BUGS: [MachineId, Inputs][] = [
  ["allowance", { allowance: "cat" }],
  ["allowance", { allowance: "" }],
  ["allowance", { allowance: "  " }],
  ["allowance", { allowance: "-5" }],
  ["savings", { price: "20", saved: "0" }],
  ["savings", { price: "-20", saved: "5" }],
  ["savings", { price: "1.2.3", saved: "1" }],
  ["savings", { price: "10", saved: "3" }],
  ["sale", { price: "40", off: "150" }],
  ["sale", { price: "-40", off: "25" }],
  ["sale", { price: "", off: "25" }],
  ["sale", { price: "40", off: "  " }],
  ["sale", { price: "40", off: "half" }],
  ["sale", { price: "$40", off: "25" }],
  ["monster", { name: "" }],
  ["monster", { name: "    " }],
  ["monster", { name: "Abcdefghijklm" }],
  ["monster", { name: "23" }],
  ["monster", { name: "Grizzle😀" }],
  ["monster", { name: "  Grizzle" }],
];

describe("every machine", () => {
  it("has a name, purpose, request or note, fields, pseudocode and a bug list", () => {
    for (const m of Object.values(MACHINES)) {
      expect(m.name && m.purpose).toBeTruthy();
      expect(m.fields.length).toBeGreaterThan(0);
      expect(m.pseudocode.length).toBeGreaterThan(1);
      expect(m.bugs.length).toBeGreaterThan(0);
    }
    for (const id of ["savings", "sale", "monster"] as MachineId[]) expect(MACHINES[id].request).toBeTruthy();
    for (const m of Object.values(MACHINES)) expect(m.prompt).toMatch(/^make an app/);
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

describe("student labels (What kind of input broke it?)", () => {
  const label = (id: MachineId, inputs: Inputs) => {
    const e = run(id, inputs);
    return labelFor(e.bugKind, e.categories, MACHINES[id]);
  };
  it("maps each bug to the label a careful student would pick", () => {
    expect(label("savings", { price: "20", saved: "0" })).toBe("zero");
    expect(label("sale", { price: "", off: "25" })).toBe("blank");
    expect(label("monster", { name: "   " })).toBe("blank");
    expect(label("savings", { price: "-20", saved: "5" })).toBe("negative");
    expect(label("sale", { price: "40", off: "-20" })).toBe("negative");
    expect(label("sale", { price: "40", off: "150" })).toBe("too_big");
    expect(label("monster", { name: "Abcdefghijklm" })).toBe("too_big");
    expect(label("sale", { price: "40", off: "half" })).toBe("not_a_number");
    expect(label("sale", { price: "$40", off: "25" })).toBe("not_a_number");
    expect(label("monster", { name: "Grizzle2" })).toBe("has_numbers");
    expect(label("monster", { name: "Grizzle😀" })).toBe("symbols");
    expect(label("savings", { price: "10", saved: "3" })).toBe("something_else");
    expect(label("monster", { name: "  Grizzle" })).toBe("something_else");
  });
  it("uses the input's kind for non-bugs, and nothing for an ordinary input", () => {
    expect(label("sale", { price: "40", off: "100" })).toBe("exact_limit");
    expect(label("savings", { price: "20", saved: "5" })).toBeNull();
  });
  it("offers number labels in number apps and name labels in the Monster Namer", () => {
    expect(studentLabels(MACHINES.sale).map((l) => l.text)).toContain("Not a number");
    expect(studentLabels(MACHINES.monster).map((l) => l.text)).toEqual(["Blank", "Too long", "Exactly the limit", "Has numbers", "Symbols or emoji", "Something else"]);
  });
});

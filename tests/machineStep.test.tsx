// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MachineStep, type BustedResult } from "@/components/student/MachineStep";
import { isNewBug, type Try } from "@/components/student/state";
import type { BustedBug } from "@/lib/types";
import { MACHINES, type MachineId } from "@/machines";

const logged: { type: string; payload: Record<string, unknown> }[] = [];
vi.mock("@/lib/logger", () => ({
  logEvent: (type: string, payload: Record<string, unknown> = {}) => logged.push({ type, payload }),
}));

/** A machine (Savings Planner by default) with a tiny in-test store standing in for Game. */
function setup(opts: { nudgeAt?: number | null; countTries?: boolean; machine?: MachineId } = {}) {
  const id = opts.machine ?? "savings";
  let tries: Try[] = [];
  const busted: BustedBug[] = [];
  const onAccept = vi.fn();
  const onNudge = vi.fn();
  const view = () => (
    <MachineStep
      machine={MACHINES[id]}
      tries={tries}
      onTry={(t) => {
        tries = [...tries, t];
        utils.rerender(view());
      }}
      isNewKind={(k) => isNewBug(busted, id, k)}
      onBusted={(r: BustedResult) => {
        if (r.counted && r.kind) busted.push({ machine: id, kind: r.kind, inputs: r.inputs });
        utils.rerender(view());
      }}
      acceptLabel="Looks good, next app →"
      onAccept={onAccept}
      nudgeAt={opts.nudgeAt ?? null}
      countTries={opts.countTries}
      onNudge={onNudge}
    />
  );
  const utils = render(view());
  return { busted, onAccept, onNudge, tries: () => tries };
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

/** Fills the boxes in order and taps Try it. */
function tryIt(...values: string[]) {
  const boxes = screen.getAllByRole("textbox");
  values.forEach((v, i) => fireEvent.change(boxes[i], { target: { value: v } }));
  click(/Try it/);
}

/** Busted! on the latest try: pick an "It should say" answer, then a label. */
function bust(expect: RegExp = /not sure/, label = "Something else") {
  click(/^💥 Busted!$/);
  fireEvent.click(screen.getByRole("button", { name: expect }));
  click(/Next/);
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("a machine", () => {
  beforeEach(() => {
    logged.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows the AI's confident badge and plain text inputs", () => {
    setup();
    expect(screen.getByText("✅ Built and tested by AI.")).toBeTruthy();
    for (const box of screen.getAllByRole("textbox")) {
      expect(box.getAttribute("type")).toBe("text");
      expect(box.getAttribute("inputmode")).toBe("decimal");
    }
  });

  it("Try it shows the buggy output and logs the classified input", () => {
    setup();
    tryIt("20", "0");
    expect(screen.getAllByText("Infinity weeks").length).toBeGreaterThan(0);
    expect(logged.find((e) => e.type === "input_submit")?.payload).toMatchObject({
      inputs: { price: "20", saved: "0" },
      output_shown: "Infinity weeks",
      categories: ["zero", "boundary"],
      reveals_bug: true,
      bug_kind: "zero",
    });
  });

  it("Busted! is only available after an input", () => {
    setup();
    expect((screen.getByRole("button", { name: /^💥 Busted!$/ }) as HTMLButtonElement).disabled).toBe(true);
    tryIt("20", "5");
    expect((screen.getByRole("button", { name: /^💥 Busted!$/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a real bug: names the kind and counts it once per kind", () => {
    const t = setup();
    tryIt("20", "0");
    bust(/not sure/, "Zero");
    expect(screen.getByText("Yes, a Zero bug!")).toBeTruthy();
    expect(logged.find((e) => e.type === "busted")?.payload).toMatchObject({
      verdict: "real",
      bug_kind: "zero",
      counted: true,
      expected_unsure: true,
      student_label: "zero",
      classifier_label: "zero",
      label_agreement: true,
    });
    click("Keep testing");
    tryIt("50", "0");
    bust(/not sure/, "Negative");
    expect(screen.getByText("We'd call that a Zero bug.")).toBeTruthy();
    expect(screen.queryByText(/different kind/)).toBeNull();
    expect(t.busted).toHaveLength(1);
  });

  it("a false alarm gets a friendly message", () => {
    setup();
    tryIt("20", "5");
    bust(/^4 weeks$/);
    expect(screen.getByText("That one works the way the request says. Keep testing!")).toBeTruthy();
    expect(logged.find((e) => e.type === "busted")?.payload).toMatchObject({ verdict: "false_alarm", classifier_label: null, label_agreement: null });
  });

  it("a debatable case (a hyphenated monster name) is never a bug", () => {
    setup({ machine: "monster" });
    tryIt("Mega-Bob");
    bust(/not sure/);
    expect(screen.getByText("There's no right answer for this one.")).toBeTruthy();
    expect(screen.getByText(/The request doesn't say if a name can have a "-"/)).toBeTruthy();
    click("It should say no");
    expect(logged.find((e) => e.type === "debatable_vote")?.payload).toMatchObject({ unclear_message: false, vote: "should_say_no" });
  });

  it("the monster shows its name, and a blank answer reads (blank)", () => {
    setup({ machine: "monster" });
    tryIt("");
    expect(screen.getByLabelText("A monster with no name")).toBeTruthy();
    click(/^💥 Busted!$/);
    expect(screen.getByRole("button", { name: "(blank)" })).toBeTruthy();
  });

  it("an input with two bugs credits the one the student names", () => {
    const t = setup({ machine: "monster" });
    tryIt("Grizzlemonster22");
    bust(/not sure/, "Too long");
    expect(screen.getByText("Yes, a Too long bug!")).toBeTruthy();
    expect(logged.find((e) => e.type === "busted")?.payload).toMatchObject({
      bug_kind: "very_long",
      bug_kinds: ["wrong_type", "very_long"],
      label_agreement: true,
      counted: true,
    });
    // The numbers bug is still there to find, with this same input.
    click("Keep testing");
    bust(/not sure/, "Has numbers");
    expect(screen.getByText("Yes, a Has numbers bug!")).toBeTruthy();
    click("Keep testing");
    expect(t.busted.map((b) => b.kind)).toEqual(["very_long", "wrong_type"]);
  });

  it("2-3 is Symbols, and calling it Not a number also counts", () => {
    setup({ machine: "sale" });
    tryIt("2-3", "25");
    bust(/not sure/, "Symbols ($ % !)");
    expect(screen.getByText("Yes, a Symbols bug!")).toBeTruthy();
    cleanup();
    logged.length = 0;
    setup({ machine: "sale" });
    tryIt("2-3", "25");
    bust(/not sure/, "Not a number");
    expect(screen.getByText("Yes, a Symbols bug!")).toBeTruthy();
    expect(logged.find((e) => e.type === "busted")?.payload).toMatchObject({ label_agreement: true, bug_kind: "special" });
  });

  it("naming neither bug credits the first one", () => {
    setup({ machine: "monster" });
    tryIt("Grizzlemonster22");
    bust(/not sure/, "Blank");
    expect(screen.getByText("We'd call that a Has numbers bug.")).toBeTruthy();
    expect(logged.find((e) => e.type === "busted")?.payload).toMatchObject({ bug_kind: "wrong_type", label_agreement: false });
  });

  it("busting the app's vague 'Invalid input' asks if the message is clear enough", () => {
    setup();
    tryIt("", "5");
    bust(/^Invalid input$/, "Blank");
    expect(screen.getByText("It said no, which is fine.")).toBeTruthy();
    click("No, it should say what's wrong");
    expect(logged.find((e) => e.type === "debatable_vote")?.payload).toMatchObject({ unclear_message: true, vote: "not_clear" });
    expect(logged.find((e) => e.type === "busted")?.payload).toMatchObject({ verdict: "debatable", unclear_message: true, expected_correct: true, counted: false });
  });

  it("Busted! can point at an earlier try", () => {
    setup();
    tryIt("-20", "5");
    tryIt("20", "5");
    click(/^💥 Busted!$/);
    click(/Pick another try/);
    fireEvent.click(screen.getByRole("button", { name: /"-20"/ }));
    click(/Money can't be below zero/);
    click(/Next/);
    click("Negative");
    expect(screen.getByText("Yes, a Negative bug!")).toBeTruthy();
    expect(logged.find((e) => e.type === "busted")?.payload).toMatchObject({ input_n: 1, expected_correct: true });
  });

  it("Looks good accepts the AI's claim", () => {
    const t = setup();
    click(/Looks good/);
    expect(t.onAccept).toHaveBeenCalledWith("button");
  });

  it("the nudge asks but never moves on by itself", () => {
    const t = setup({ nudgeAt: Date.now() + 180_000 });
    expect(screen.queryByText(/Ready for the next app/)).toBeNull();
    act(() => vi.advanceTimersByTime(180_500));
    expect(screen.getByText(/Ready for the next app/)).toBeTruthy();
    expect(t.onNudge).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(600_000));
    expect(t.onAccept).not.toHaveBeenCalled();
    click("Keep testing");
    expect(screen.queryByText(/Ready for the next app/)).toBeNull();
  });

  it("counts tries with no limit", () => {
    setup({ countTries: true });
    tryIt("10", "5");
    expect(screen.getByText("try")).toBeTruthy();
    for (let i = 2; i <= 12; i++) tryIt(String(i * 10), "5");
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("tries")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Try it/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});

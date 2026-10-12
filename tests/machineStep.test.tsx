// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MachineStep, type BustedResult } from "@/components/student/MachineStep";
import { isNewBug, type Try } from "@/components/student/state";
import type { BustedBug } from "@/lib/types";
import { MACHINES } from "@/machines";

const logged: { type: string; payload: Record<string, unknown> }[] = [];
vi.mock("@/lib/logger", () => ({
  logEvent: (type: string, payload: Record<string, unknown> = {}) => logged.push({ type, payload }),
}));

/** Pizza Splitter with a tiny in-test store standing in for Game. */
function setup(opts: { nudgeAt?: number | null; maxTries?: number } = {}) {
  let tries: Try[] = [];
  const busted: BustedBug[] = [];
  const onAccept = vi.fn();
  const onNudge = vi.fn();
  const view = () => (
    <MachineStep
      machine={MACHINES.pizza}
      title="Machine 1 of 3"
      tries={tries}
      onTry={(t) => {
        tries = [...tries, t];
        utils.rerender(view());
      }}
      isNewKind={(k) => isNewBug(busted, "pizza", k)}
      onBusted={(r: BustedResult) => {
        if (r.counted && r.kind) busted.push({ machine: "pizza", kind: r.kind, inputs: r.inputs });
        utils.rerender(view());
      }}
      acceptLabel="Looks good, next machine →"
      onAccept={onAccept}
      nudgeAt={opts.nudgeAt ?? null}
      maxTries={opts.maxTries}
      onNudge={onNudge}
    />
  );
  const utils = render(view());
  return { busted, onAccept, onNudge, tries: () => tries };
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

function tryIt(slices: string, friends: string) {
  const [s, f] = screen.getAllByRole("textbox");
  fireEvent.change(s, { target: { value: slices } });
  fireEvent.change(f, { target: { value: friends } });
  click(/Try it/);
}

function bust(expect: RegExp = /not sure/) {
  click(/^💥 Busted!$/);
  fireEvent.click(screen.getByRole("button", { name: expect }));
  fireEvent.click(screen.getAllByRole("button", { name: /Busted!/ }).at(-1)!);
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
    expect(screen.getByText(/I tested it. It works perfectly!/)).toBeTruthy();
    for (const box of screen.getAllByRole("textbox")) {
      expect(box.getAttribute("type")).toBe("text");
      expect(box.getAttribute("inputmode")).toBe("decimal");
    }
  });

  it("Try it shows the buggy output and logs the classified input", () => {
    setup();
    tryIt("8", "0");
    expect(screen.getAllByText("Each friend gets Infinity slices").length).toBeGreaterThan(0);
    expect(logged.find((e) => e.type === "input_submit")?.payload).toMatchObject({
      inputs: { slices: "8", friends: "0" },
      output_shown: "Each friend gets Infinity slices",
      categories: ["zero"],
      reveals_bug: true,
      bug_kind: "zero",
    });
  });

  it("Busted! is only available after an input", () => {
    setup();
    expect((screen.getByRole("button", { name: /^💥 Busted!$/ }) as HTMLButtonElement).disabled).toBe(true);
    tryIt("8", "4");
    expect((screen.getByRole("button", { name: /^💥 Busted!$/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("a real bug: names the kind and counts it once per kind", () => {
    const t = setup();
    tryIt("8", "0");
    bust();
    expect(screen.getByText("Busted! You found a Zero bug 🎉")).toBeTruthy();
    expect(logged.find((e) => e.type === "busted")?.payload).toMatchObject({ verdict: "real", bug_kind: "zero", counted: true, expected_unsure: true });
    click("Keep testing");
    tryIt("5", "0");
    bust();
    expect(screen.getByText("Busted! Another Zero bug.")).toBeTruthy();
    expect(screen.queryByText(/different kind/)).toBeNull();
    expect(t.busted).toHaveLength(1);
  });

  it("a false alarm and a debatable case get friendly messages", () => {
    setup();
    tryIt("8", "4");
    bust(/^Each friend gets 2 slices$/);
    expect(screen.getByText("Hmm, that one works the way it should. Keep testing!")).toBeTruthy();
    click("Keep testing");
    tryIt("8", "3");
    bust(/not sure/);
    expect(screen.getByText("Good thinking. People might disagree about this one!")).toBeTruthy();
  });

  it("Busted! can point at an earlier try", () => {
    setup();
    tryIt("8", "-2");
    tryIt("8", "4");
    click(/^💥 Busted!$/);
    click(/Pick another try/);
    fireEvent.click(screen.getByRole("button", { name: /"-2"/ }));
    click(/Numbers can't be below zero/);
    fireEvent.click(screen.getAllByRole("button", { name: /Busted!/ }).at(-1)!);
    expect(screen.getByText("Busted! You found a Negative bug 🎉")).toBeTruthy();
    expect(logged.find((e) => e.type === "busted")?.payload).toMatchObject({ input_n: 1, expected_correct: true });
  });

  it("Looks good accepts the AI's claim", () => {
    const t = setup();
    click(/Looks good/);
    expect(t.onAccept).toHaveBeenCalledWith("button");
  });

  it("the nudge asks but never moves on by itself", () => {
    const t = setup({ nudgeAt: Date.now() + 180_000 });
    expect(screen.queryByText(/Ready for the next machine/)).toBeNull();
    act(() => vi.advanceTimersByTime(180_500));
    expect(screen.getByText(/Ready for the next machine/)).toBeTruthy();
    expect(t.onNudge).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(600_000));
    expect(t.onAccept).not.toHaveBeenCalled();
    click("Keep testing");
    expect(screen.queryByText(/Ready for the next machine/)).toBeNull();
  });

  it("caps tries: after the 8th, Try it is off but Busted! still works", () => {
    setup({ maxTries: 8 });
    for (let i = 1; i <= 8; i++) tryIt(String(i), "2");
    expect(screen.getByText("Tries: 8 of 8")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Try it/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/That was your last try/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^💥 Busted!$/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(logged.filter((e) => e.type === "tries_used_up")).toHaveLength(1);
  });
});

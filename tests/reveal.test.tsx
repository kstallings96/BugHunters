// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MachineReveal } from "@/components/student/Reveal";
import type { BustedBug } from "@/lib/types";

const logged: { type: string; payload: Record<string, unknown> }[] = [];
vi.mock("@/lib/logger", () => ({
  logEvent: (type: string, payload: Record<string, unknown> = {}) => logged.push({ type, payload }),
}));

const busted: BustedBug[] = [
  { machine: "savings", kind: "zero", inputs: { price: "20", saved: "0" } },
  { machine: "monster", kind: "empty", inputs: { name: "" } },
];

describe("missed-bug reveal", () => {
  afterEach(() => {
    cleanup();
    logged.length = 0;
  });

  it("one app: found kinds checked, hiding kinds with an example, and the AI's own tests", () => {
    render(<MachineReveal machine="savings" busted={busted} last={false} onNext={() => {}} />);
    expect(screen.getByText(/Zero: you found it!/)).toBeTruthy();
    expect(screen.getByText(/Try \$10 with \$3 a week/)).toBeTruthy();
    expect(screen.queryByText(/Leave the name empty/)).toBeNull(); // other apps' bugs aren't shown
    expect(screen.getByText(/what the AI tested/)).toBeTruthy();
    expect(screen.getByText(/Price: 100, Saved per week: 20 → 5 weeks/)).toBeTruthy();
    expect(screen.queryByText("The AI only tried ordinary inputs.")).toBeNull();
    expect(logged[0]).toMatchObject({ type: "reveal_view", payload: { scope: "machine", reveal_machine: "savings", found: ["zero"] } });
    expect((logged[0].payload.missed as string[]).length).toBe(4);
  });

  it("celebrates finding every bug in an app, only at the reveal", () => {
    const all: BustedBug[] = ["zero", "negative", "wrong_type", "rounding", "special"].map((kind) => ({ machine: "savings", kind: kind as BustedBug["kind"], inputs: {} }));
    render(<MachineReveal machine="savings" busted={all} last={false} onNext={() => {}} />);
    expect(screen.getByText("You found every bug the AI left in Savings Planner!")).toBeTruthy();
    expect(logged[0].payload).toMatchObject({ all_found: true });
    cleanup();
    render(<MachineReveal machine="savings" busted={busted} last={false} onNext={() => {}} />);
    expect(screen.queryByText(/You found every bug/)).toBeNull();
  });
});

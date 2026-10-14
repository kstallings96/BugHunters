import type { Inputs, MachineId } from "@/machines/types";

/**
 * The tests the AI wrote for its own app (generation/runs/.../sample-NN.tests.json),
 * shown at the missed-bug reveal beside what the student found. Copied word
 * for word, in the model's order, except:
 *   - savings: two tests are left out because they test the two lines the
 *     research team changed (they would fail on the app students see):
 *       { price: "100", saved: "30" } expects "4 weeks"  (rounding, planted)
 *       { price: "100", saved: "0" }  expects "Invalid input"  (zero, planted)
 *   - "NaN" in an expected answer is shown as "???", like the app shows it.
 * tests/aiTests.test.ts checks every test here passes on the app as shown.
 */
export const AI_TESTS_SOURCE: "placeholder" | "generated" = "generated";

export interface AiTest {
  inputs: Inputs;
  /** What the AI expected its app to say. */
  expects: string;
}

export const AI_TESTS: Partial<Record<MachineId, AiTest[]>> = {
  // generation/runs/2026-10-13T17-15-39-803Z/savings/sample-03.tests.json
  savings: [
    { inputs: { price: "100", saved: "20" }, expects: "5 weeks" },
    { inputs: { price: "20", saved: "20" }, expects: "1 week" },
    { inputs: { price: "abc", saved: "10" }, expects: "Invalid input" },
    { inputs: { price: "100", saved: "-5" }, expects: "Invalid input" },
    { inputs: { price: "100.50", saved: "10.05" }, expects: "10 weeks" },
    { inputs: { price: "0", saved: "10" }, expects: "0 weeks" },
    { inputs: { price: "50", saved: "invalid" }, expects: "Invalid input" },
  ],
  // generation/runs/2026-10-13T17-15-39-803Z/sale/sample-04.tests.json
  sale: [
    { inputs: { price: "100", off: "20" }, expects: "Sale price: $80.00" },
    { inputs: { price: "50.50", off: "10" }, expects: "Sale price: $45.45" },
    { inputs: { price: "200", off: "0" }, expects: "Sale price: $200.00" },
    { inputs: { price: "100", off: "100" }, expects: "Sale price: $0.00" },
    { inputs: { price: "19.99", off: "15" }, expects: "Sale price: $16.99" },
    { inputs: { price: "abc", off: "10" }, expects: "Sale price: $NaN" },
  ],
  // generation/runs/2026-10-14T00-15-39-037Z/monster/sample-03.tests.json
  monster: [
    { inputs: { name: "goblin" }, expects: "GOBLIN" },
    { inputs: { name: "skeletonking" }, expects: "SKELETONKING" },
    { inputs: { name: "abominablesnowman" }, expects: "ABOMINABLESN" },
    { inputs: { name: "a" }, expects: "A" },
    { inputs: { name: "" }, expects: "" },
    { inputs: { name: "VERYLONGMONSTERNAME" }, expects: "VERYLONGMONS" },
  ],
};

/** An expected answer the way the reveal shows it. */
export const shownExpectation = (expects: string) => expects.replace(/NaN/g, "???");

import type { Inputs, MachineId } from "@/machines/types";

/**
 * The tests "the AI" wrote for its own app, shown at the missed-bug reveal
 * beside what the student found.
 *
 * Until the generation script runs, these are placeholders written to look
 * like typical AI-written tests (all ordinary inputs), and the reveal labels
 * them "example". The script replaces them with the model's real tests and
 * sets AI_TESTS_SOURCE to "generated".
 */
export const AI_TESTS_SOURCE: "placeholder" | "generated" = "placeholder";

export interface AiTest {
  inputs: Inputs;
  /** What the AI expected its app to say. */
  expects: string;
}

export const AI_TESTS: Partial<Record<MachineId, AiTest[]>> = {
  savings: [
    { inputs: { price: "20", saved: "5" }, expects: "4 weeks" },
    { inputs: { price: "100", saved: "10" }, expects: "10 weeks" },
    { inputs: { price: "50", saved: "25" }, expects: "2 weeks" },
  ],
  sale: [
    { inputs: { price: "40", off: "25" }, expects: "Sale price: $30" },
    { inputs: { price: "100", off: "10" }, expects: "Sale price: $90" },
    { inputs: { price: "80", off: "50" }, expects: "Sale price: $40" },
  ],
  jersey: [
    { inputs: { name: "Smith" }, expects: "SMITH" },
    { inputs: { name: "Johnson" }, expects: "JOHNSON" },
    { inputs: { name: "Lee" }, expects: "LEE" },
  ],
};

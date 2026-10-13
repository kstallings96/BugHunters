import { runInNewContext } from "node:vm";
import { MACHINES, evaluate } from "@/machines";
import type { Category, Inputs, MachineId } from "@/machines/types";
import { GEN_SPECS, RAFFLE_GEN, type GenSpec } from "./specs";

/**
 * Runs generated functions against each machine's edge-case battery and
 * compares them with the reference version. Shared by the generation script
 * and its self-test (which feeds in the hand-written buggy machines).
 *
 * Generated outputs won't match the reference word for word, so outcomes are
 * compared by kind: an ANSWER (the requested format, e.g. "4 weeks"), a
 * MESSAGE (any other text: the app refused the input), or a CRASH.
 */

export type Outcome = { kind: "answer"; text: string } | { kind: "message"; text: string } | { kind: "crash"; error: string };

export interface Finding {
  inputs: Inputs;
  expected: string;
  got: string;
  /** The bug kind this input reveals, as the classifier names it. */
  bug: Category | "rejects_valid";
}

/** Loads one function out of model-written code. Throws if it isn't there. */
export function loadFunction(code: string, name: string): (...args: string[]) => unknown {
  const fn = runInNewContext(`${code}\n;typeof ${name} === "function" ? ${name} : undefined`, {}, { timeout: 1000 });
  if (typeof fn !== "function") throw new Error(`no function named ${name}`);
  return fn as (...args: string[]) => unknown;
}

// "???" is how the hand-written apps display NaN, so it counts as an answer too.
const NUM = String.raw`(-?[\d.,]+|NaN|\?\?\?|Infinity|-Infinity|undefined)`;
const ANSWER: Partial<Record<MachineId, RegExp>> = {
  allowance: new RegExp(String.raw`^\$\s?${NUM}$`),
  savings: new RegExp(String.raw`^${NUM} weeks?$`),
  sale: new RegExp(String.raw`^Sale price: \$\s?${NUM}$`),
};

/** Is this text an answer in the requested format, or a refusal message? */
export function classifyOutput(machine: MachineId, text: string, refAnswer: string | null): Outcome {
  const pattern = ANSWER[machine];
  if (pattern) return pattern.test(text.trim()) ? { kind: "answer", text: text.trim() } : { kind: "message", text };
  // Jersey: the printed name is an answer when it looks like a name (or is
  // blank / matches the reference); sentences are messages.
  if (refAnswer !== null && text === refAnswer) return { kind: "answer", text };
  return /\s\w+\s|[.!?]$/.test(text.trim()) && text.trim().length > 14 ? { kind: "message", text } : { kind: "answer", text };
}

function run(fn: (...a: string[]) => unknown, spec: GenSpec, inputs: Inputs): Outcome {
  try {
    const out = fn(...spec.params.map((p) => inputs[p] ?? ""));
    return classifyOutput(spec.machine, String(out), null);
  } catch (e) {
    return { kind: "crash", error: (e as Error).message };
  }
}

// Number answers are compared loosely ("$30.00" = "$30", "1 weeks" = "1 week");
// printed names exactly, because stray spaces on a jersey are themselves a bug.
const normalize = (machine: MachineId, s: string) =>
  machine === "jersey" ? s : s.replace(/weeks?/, "").replace(/[$,\s]/g, "").replace(/\.0+(?=\D|$)/, "");

/** Every bug this function shows on the battery. */
export function findBugs(spec: GenSpec, fn: (...a: string[]) => unknown): Finding[] {
  const machine = MACHINES[spec.machine];
  const out: Finding[] = [];
  for (const inputs of spec.battery) {
    const e = evaluate(machine, inputs, { today: new Date() });
    if (e.debatable) continue;
    const got = run(fn, spec, inputs);
    const gotText = got.kind === "crash" ? `crash: ${got.error}` : got.text;
    if (e.reference.type === "not_allowed") {
      // Any refusal message is fine; an answer or a crash is a bug.
      if (got.kind !== "message") out.push({ inputs, expected: e.reference.text, got: gotText, bug: e.reference.rule });
    } else if (got.kind === "answer") {
      if (normalize(spec.machine, got.text) !== normalize(spec.machine, e.reference.text))
        out.push({ inputs, expected: e.reference.text, got: gotText, bug: e.bugKind ?? machine.resultBugKind?.(inputs, e.categories) ?? e.categories[0] });
    } else {
      // Refusing (or crashing on) something the request allows.
      out.push({ inputs, expected: e.reference.text, got: gotText, bug: got.kind === "crash" ? (e.categories[0] === "normal" ? "rejects_valid" : e.categories[0]) : "rejects_valid" });
    }
  }
  return out;
}

export interface RaffleFindings {
  lastNeverWins: boolean;
  blankCanWin: boolean;
  emptyGivesJunk: boolean;
  oneNameWins: boolean;
  notes: string[];
}

/** Statistical checks for a generated pickWinner(namesText). */
export function raffleBugs(fn: (...a: string[]) => unknown, trials = 400): RaffleFindings {
  const call = (text: string) => {
    try {
      return { ok: true as const, value: fn(text) };
    } catch (e) {
      return { ok: false as const, value: (e as Error).message };
    }
  };
  const notes: string[] = [];
  const four = Array.from({ length: trials }, () => call("Sam\nJay\nMaria\nLeo").value);
  const lastNeverWins = !four.includes("Leo");
  const blank = Array.from({ length: trials }, () => call("Sam\n\nJay").value);
  const blankCanWin = blank.some((w) => typeof w === "string" && w.trim() === "");
  const empty = call("");
  const emptyGivesJunk = empty.ok && (empty.value === undefined || String(empty.value) === "undefined" || String(empty.value).trim() === "");
  if (!empty.ok) notes.push(`empty list crashes: ${empty.value}`);
  const one = call("Sam");
  const oneNameWins = one.ok && one.value === "Sam";
  return { lastNeverWins, blankCanWin, emptyGivesJunk: emptyGivesJunk || !empty.ok, oneNameWins, notes };
}

export { GEN_SPECS, RAFFLE_GEN };

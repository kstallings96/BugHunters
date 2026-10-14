import { allowance } from "./allowance";
import { monster } from "./monster";
import { sale } from "./sale";
import { savings } from "./savings";
import { classifyNumberField, classifyTextField, finalize, parseMoney, stableHash } from "./classify";
import { CATEGORY_LABEL } from "./types";
import type { BustedVerdict, Category, Context, Evaluation, Inputs, Machine, MachineId, Output } from "./types";

export * from "./types";
export * from "./labels";

export const MACHINES: Record<MachineId, Machine> = {
  allowance,
  savings,
  sale,
  monster,
};

/** The two number machines; one of them goes first (counterbalanced). */
export const NUMBER_MACHINES: MachineId[] = ["savings", "sale"];

export function categorize(machine: Machine, inputs: Inputs, ctx: Context): Category[] {
  const cats: Category[] = [];
  for (const f of machine.fields) {
    const raw = inputs[f.id] ?? "";
    if (f.kind === "number") cats.push(...classifyNumberField(raw));
    else if (f.kind === "text") cats.push(...classifyTextField(raw, f.longAt));
  }
  cats.push(...(machine.extraCategories?.(inputs, ctx) ?? []));
  return finalize(cats);
}

/** Same answer, or both refuse (in any words: the app's "Invalid input" counts). */
const refuses = (o: Output) => o.type !== "result";
const same = (a: Output, b: Output) => (refuses(a) && refuses(b)) || (a.type === b.type && a.text === b.text);

/**
 * Ground truth for one input: run it through the buggy and reference
 * versions. Different outputs reveal a bug, unless the input is debatable.
 */
export function evaluate(machine: Machine, inputs: Inputs, ctx: Context): Evaluation {
  const categories = categorize(machine, inputs, ctx);
  const buggy = machine.buggy(inputs, ctx);
  const reference = machine.reference(inputs, ctx);
  const debatable = machine.debatable(inputs, ctx) || (writesDollar(machine, inputs) && buggy.type !== "result");
  const differs = !same(buggy, reference);
  let bugKind: Category | null = null;
  if (differs && !debatable) {
    bugKind = reference.type === "not_allowed" ? reference.rule : (machine.resultBugKind?.(inputs, categories) ?? categories[0]);
  }
  return { categories, buggy, reference, revealsBug: differs && !debatable, bugKind, debatable };
}

/**
 * Money typed with a dollar sign ("$20") that the app REFUSES: the request
 * doesn't say whether "$" is OK, so refusing it is debatable, never a bug.
 * (An app that breaks on it, showing "$???", still has a bug.)
 */
export function writesDollar(machine: Machine, inputs: Inputs): boolean {
  return machine.fields.some((f) => f.kind === "number" && /^\s*\$/.test(inputs[f.id] ?? "") && parseMoney(inputs[f.id]) !== null);
}

/** What a Busted! on this input means. */
export function verdictFor(e: Pick<Evaluation, "revealsBug" | "debatable">): BustedVerdict {
  if (e.debatable) return "debatable";
  return e.revealsBug ? "real" : "false_alarm";
}

/**
 * Choices for "It should say…": the correct output, what the machine actually
 * said, and plausible others, three in all, in a stable mixed order.
 */
export function answerChoices(machine: Machine, inputs: Inputs, shownText: string, correctText: string): { options: string[]; correct: number } {
  const pool = [correctText, shownText, ...machine.otherAnswers(inputs)];
  const unique = [...new Set(pool)].slice(0, 3);
  const shift = stableHash(JSON.stringify(inputs)) % unique.length;
  const options = [...unique.slice(shift), ...unique.slice(0, shift)];
  return { options, correct: options.indexOf(correctText) };
}

/** What students call this kind of bug on this machine ("Has numbers" on the Monster Namer). */
export function bugLabel(machine: Machine | MachineId | "raffle", kind: Category): string {
  const m = typeof machine === "string" ? (machine === "raffle" ? null : MACHINES[machine]) : machine;
  return m?.labels?.[kind] ?? CATEGORY_LABEL[kind];
}

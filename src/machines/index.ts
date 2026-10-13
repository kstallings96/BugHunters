import { allowance } from "./allowance";
import { jersey } from "./jersey";
import { sale } from "./sale";
import { savings } from "./savings";
import { birthday } from "./birthday";
import { classifyNumberField, classifyTextField, finalize, stableHash } from "./classify";
import type { BustedVerdict, Category, Context, Evaluation, Inputs, Machine, MachineId, Output } from "./types";

export * from "./types";
export * from "./labels";

export const MACHINES: Record<MachineId, Machine> = {
  allowance,
  savings,
  sale,
  jersey,
  birthday,
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

const same = (a: Output, b: Output) => a.type === b.type && a.text === b.text;

/**
 * Ground truth for one input: run it through the buggy and reference
 * versions. Different outputs reveal a bug, unless the input is debatable.
 */
export function evaluate(machine: Machine, inputs: Inputs, ctx: Context): Evaluation {
  const categories = categorize(machine, inputs, ctx);
  const buggy = machine.buggy(inputs, ctx);
  const reference = machine.reference(inputs, ctx);
  const debatable = machine.debatable(inputs, ctx);
  const differs = !same(buggy, reference);
  let bugKind: Category | null = null;
  if (differs && !debatable) {
    bugKind = reference.type === "not_allowed" ? reference.rule : (machine.resultBugKind?.(inputs, categories) ?? categories[0]);
  }
  return { categories, buggy, reference, revealsBug: differs && !debatable, bugKind, debatable };
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

import { birthday } from "./birthday";
import { classifyNumberField, classifyTextField, finalize } from "./classify";
import { doubleIt } from "./doubleIt";
import { grade } from "./grade";
import { nameGreeter } from "./name";
import { pizza } from "./pizza";
import type { BustedVerdict, Category, Context, Evaluation, Inputs, Machine, MachineId, Output } from "./types";

export * from "./types";

export const MACHINES: Record<MachineId, Machine> = {
  double: doubleIt,
  pizza,
  grade,
  name: nameGreeter,
  birthday,
};

/** The two number machines; one of them goes first (counterbalanced). */
export const NUMBER_MACHINES: MachineId[] = ["pizza", "grade"];

export function categorize(machine: Machine, inputs: Inputs, ctx: Context): Category[] {
  const cats: Category[] = [];
  for (const f of machine.fields) {
    const raw = inputs[f.id] ?? "";
    if (f.kind === "number") cats.push(...classifyNumberField(raw));
    else if (f.kind === "text") cats.push(...classifyTextField(raw));
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

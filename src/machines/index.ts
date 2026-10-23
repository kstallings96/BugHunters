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
  // An input can break several rules at once; every one the app gets wrong counts.
  const known = new Set(machine.bugs.map((b) => b.kind));
  const bugKinds = bugKind ? [...new Set([bugKind, ...(machine.rulesBroken?.(inputs, ctx) ?? []).filter((k) => known.has(k))])] : [];
  const unclearMessage = buggy.type === "message" && reference.type === "not_allowed";
  return { categories, buggy, reference, revealsBug: differs && !debatable, bugKind, bugKinds, debatable, unclearMessage };
}

/**
 * Money typed with a dollar sign ("$20") that the app REFUSES: the request
 * doesn't say whether "$" is OK, so refusing it is debatable, never a bug.
 * (An app that breaks on it, showing "$???", still has a bug.)
 */
export function writesDollar(machine: Machine, inputs: Inputs): boolean {
  return machine.fields.some((f) => f.kind === "number" && /^\s*\$/.test(inputs[f.id] ?? "") && parseMoney(inputs[f.id]) !== null);
}

/** "The request doesn't say …": what exactly is open to debate for this input. */
export function debatableReason(machine: Machine, inputs: Inputs): string {
  if (writesDollar(machine, inputs)) return 'The request doesn\'t say if you can type a "$" sign.';
  return machine.debatableWhy?.(inputs) ?? "The request doesn't say if this is OK.";
}

/** What a Busted! on this input means. */
export function verdictFor(e: Pick<Evaluation, "revealsBug" | "debatable"> & { unclearMessage?: boolean }): BustedVerdict {
  // A vague refusal ("Invalid input") isn't wrong, but is it clear enough? The request doesn't say.
  if (e.debatable || e.unclearMessage) return "debatable";
  return e.revealsBug ? "real" : "false_alarm";
}

/**
 * Every right "It should say…" answer. Usually one; but when the input breaks
 * several rules (a price below zero AND $0 a week), each rule's message is
 * right too.
 */
export function correctAnswers(machine: Machine, inputs: Inputs, ctx: Context = { today: new Date() }): string[] {
  const reference = machine.reference(inputs, ctx);
  const out = [reference.text];
  if (reference.type === "not_allowed") {
    // Each box on its own, the others ordinary: its own problem, its own message.
    if (machine.goodInputs && machine.fields.length > 1)
      for (const f of machine.fields) {
        const alone = machine.reference({ ...machine.goodInputs, [f.id]: inputs[f.id] ?? "" }, ctx);
        if (alone.type === "not_allowed") out.push(alone.text);
      }
    for (const k of machine.rulesBroken?.(inputs, ctx) ?? []) {
      const m = machine.ruleMessages?.[k];
      if (m) out.push(m);
    }
  }
  return [...new Set(out)];
}

/**
 * Choices for "It should say…": the right answer(s), what the app actually
 * said, and one believable wrong one, in a stable mixed order. When the right
 * answer is a message, the wrong one is another real message that doesn't fit
 * this input (never a made-up number like "0 weeks").
 */
export function answerChoices(machine: Machine, inputs: Inputs, shownText: string, ctx: Context = { today: new Date() }): { options: string[]; correct: number[] } {
  const refuses = machine.reference(inputs, ctx).type === "not_allowed";
  // The app's own refusal ("Invalid input") is a right answer too where refusing is right.
  const appRefusalOk = refuses && machine.buggy(inputs, ctx).type === "message";
  const right = [...correctAnswers(machine, inputs, ctx).slice(0, 2), ...(appRefusalOk ? [shownText] : [])];
  const wrongPool = (refuses ? machine.messages : machine.otherAnswers(inputs)).filter((o) => !right.includes(o) && o !== shownText);
  const wrong = wrongPool.length ? [wrongPool[stableHash(JSON.stringify(inputs)) % wrongPool.length]] : [];
  const unique = [...new Set([...right, shownText, ...wrong])];
  const shift = stableHash(JSON.stringify(inputs)) % unique.length;
  const options = [...unique.slice(shift), ...unique.slice(0, shift)];
  return { options, correct: options.map((o, i) => (right.includes(o) ? i : -1)).filter((i) => i >= 0) };
}

/** What students call this kind of bug on this machine ("Has numbers" on the Monster Namer). */
export function bugLabel(machine: Machine | MachineId | "raffle", kind: Category): string {
  const m = typeof machine === "string" ? (machine === "raffle" ? null : MACHINES[machine]) : machine;
  return m?.labels?.[kind] ?? CATEGORY_LABEL[kind];
}

/**
 * How a wrong answer shows itself. "loud": the output itself looks broken
 * ($???, Infinity, or nothing at all), so it announces the bug. "silent": a
 * normal-looking answer that's wrong for the request ("3 weeks" instead of
 * 4, "Sale price: $48.00" for -20% off), which takes checking against the
 * request to catch. Judged per output: the same bug kind can be either.
 */
export function bugVisibility(shown: string): "loud" | "silent" {
  return shown.trim() === "" || /\?\?\?|Infinity/.test(shown) ? "loud" : "silent";
}

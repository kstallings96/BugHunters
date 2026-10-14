"use client";

import { useEffect, useState, type ReactNode } from "react";
import { blankInputs, MachineCard } from "@/components/MachineCard";
import { BigButton, Modal, OptionButton } from "@/components/ui";
import { clean } from "@/lib/clean";
import { logEvent } from "@/lib/logger";
import {
  answerChoices,
  bugLabel,
  evaluate,
  labelFor,
  studentLabels,
  verdictFor,
  withArticle,
  type BustedVerdict,
  type Category,
  type Inputs,
  type Machine,
  type StudentLabel,
} from "@/machines";
import type { Try } from "./state";

/**
 * One machine: try inputs, then call Busted! on one of them, or accept the
 * AI's claim and move on. Used for the tutorial, the three machines and the
 * bonus.
 */

const MAX_INPUT = 200;

function describeInputs(machine: Machine, inputs: Inputs): string {
  return machine.fields
    .map((f) => {
      const raw = clean(inputs[f.id] ?? "");
      const shown = f.kind === "select" ? (f.options!.find((o) => o.value === raw)?.label ?? raw) : raw === "" ? "(empty)" : `"${raw}"`;
      return machine.fields.length > 1 ? `${f.label}: ${shown}` : shown;
    })
    .join(", ");
}

export interface BustedResult {
  verdict: BustedVerdict;
  kind: Category | null;
  inputs: Inputs;
  /** A real bug of a kind not yet busted on this machine. */
  counted: boolean;
  /** The student's own label matched the classifier's. */
  labelAgrees: boolean;
}

export function MachineStep({
  machine,
  title,
  tries,
  onTry,
  isNewKind,
  onBusted,
  acceptLabel,
  onAccept,
  nudgeAt,
  onNudge,
  coach,
  highlightField,
  pulseBusted = false,
  locked = false,
  maxTries,
}: {
  machine: Machine;
  title: string;
  tries: Try[];
  onTry: (t: Try) => void;
  isNewKind: (kind: Category) => boolean;
  onBusted: (r: BustedResult) => void;
  acceptLabel?: string;
  onAccept?: (via: "button" | "nudge") => void;
  /** Epoch ms when "Ready for the next machine?" may appear; null for never. */
  nudgeAt?: number | null;
  onNudge?: () => void;
  /** Tutorial guidance shown above the tools. */
  coach?: ReactNode;
  highlightField?: string;
  pulseBusted?: boolean;
  /** Tutorial steps that wait for one specific action. */
  locked?: boolean;
  /** Tries allowed on this machine; scarcity makes each one a choice. Unlimited if absent. */
  maxTries?: number;
}) {
  const [values, setValues] = useState<Inputs>(() => blankInputs(machine));
  const [bustOpen, setBustOpen] = useState(false);
  const [nudge, setNudge] = useState<"hidden" | "shown" | "dismissed">("hidden");
  const last = tries.at(-1) ?? null;
  const outOfTries = maxTries !== undefined && tries.length >= maxTries;

  useEffect(() => {
    if (nudgeAt == null) return;
    const t = window.setTimeout(
      () => {
        setNudge((n) => (n === "hidden" ? "shown" : n));
        onNudge?.();
      },
      Math.max(0, nudgeAt - Date.now()),
    );
    return () => window.clearTimeout(t);
    // onNudge only logs; re-arming the timer for a new callback would double-log.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudgeAt]);

  function tryIt() {
    const inputs = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.slice(0, MAX_INPUT)]));
    const e = evaluate(machine, inputs, { today: new Date() });
    const t: Try = {
      n: tries.length + 1,
      inputs,
      output: e.buggy,
      correct: e.reference.text,
      categories: e.categories,
      revealsBug: e.revealsBug,
      bugKind: e.bugKind,
      debatable: e.debatable,
    };
    logEvent("input_submit", {
      n: t.n,
      inputs,
      output_shown: e.buggy.text,
      reference_output: e.reference.text,
      categories: e.categories,
      reveals_bug: e.revealsBug,
      bug_kind: e.bugKind,
      debatable: e.debatable,
    });
    onTry(t);
    if (maxTries !== undefined && t.n === maxTries) logEvent("tries_used_up", { max: maxTries });
  }

  return (
    <main className="relative grid min-h-0 flex-1 grid-cols-[1fr_21rem] gap-5 px-5 py-4">
      <div className="flex min-h-0 flex-col gap-3">
        {coach}
        {nudge === "shown" && (
          <div className="flex items-center gap-4 rounded-2xl border-4 border-amber bg-amber-soft px-4 py-2">
            <p className="flex-1 text-xl font-bold">🙂 Ready for the next machine?</p>
            <BigButton
              className="min-h-12! px-5! text-lg!"
              onClick={() => {
                logEvent("nudge_response", { choice: "next" });
                onAccept?.("nudge");
              }}
            >
              Next machine →
            </BigButton>
            <BigButton
              variant="secondary"
              className="min-h-12! px-5! text-lg!"
              onClick={() => {
                logEvent("nudge_response", { choice: "keep_testing" });
                setNudge("dismissed");
              }}
            >
              Keep testing
            </BigButton>
          </div>
        )}
        <MachineCard
          machine={machine}
          values={values}
          onChange={setValues}
          onTry={tryIt}
          output={last?.output ?? null}
          highlightField={highlightField}
          disabled={locked || outOfTries}
        />
      </div>

      <aside className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-ink-soft">{title}</p>
          {maxTries !== undefined && (
            <p className="rounded-full bg-paper px-3 py-0.5 text-lg font-bold" aria-live="polite">
              Tries: {tries.length} of {maxTries}
            </p>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col rounded-3xl border-2 border-line bg-card p-3">
          <p className="mb-1 text-lg font-bold">Your tries</p>
          {outOfTries && <p className="mb-1 rounded-xl bg-amber-soft px-3 py-1 text-base font-bold">That was your last try! Bust a bug, or move on.</p>}
          {tries.length === 0 ? (
            <p className="text-base text-ink-soft">Nothing yet. Type something and tap Try it.</p>
          ) : (
            <ol className="flex min-h-0 flex-col gap-1 overflow-y-auto">
              {[...tries].reverse().map((t) => (
                <li key={t.n} className="rounded-xl bg-paper px-3 py-1 text-base leading-snug">
                  <span className="font-bold">{describeInputs(machine, t.inputs)}</span>
                  <span className="text-ink-soft"> → </span>
                  <span className="break-all whitespace-pre-wrap">{t.output.text.trim() === "" ? "(blank)" : clean(t.output.text)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <BigButton
          variant="danger"
          disabled={tries.length === 0}
          onClick={() => {
            logEvent("busted_open", { tries: tries.length });
            setBustOpen(true);
          }}
          className={`min-h-20! text-2xl! ${pulseBusted && tries.length ? "animate-pulse ring-4 ring-amber" : ""}`}
        >
          💥 Busted!
        </BigButton>
        {onAccept && acceptLabel && (
          <BigButton variant="secondary" onClick={() => onAccept("button")} className="min-h-14! text-lg!">
            {acceptLabel}
          </BigButton>
        )}
      </aside>

      {bustOpen && (
        <BustedDialog
          machine={machine}
          tries={tries}
          isNewKind={isNewKind}
          onCancel={() => {
            logEvent("busted_cancel", {});
            setBustOpen(false);
          }}
          onDone={(r) => {
            setBustOpen(false);
            onBusted(r);
          }}
        />
      )}
    </main>
  );
}

// ----------------------------------------------------------- Busted!

function BustedDialog({
  machine,
  tries,
  isNewKind,
  onCancel,
  onDone,
}: {
  machine: Machine;
  tries: Try[];
  isNewKind: (kind: Category) => boolean;
  onCancel: () => void;
  onDone: (r: BustedResult) => void;
}) {
  const [pick, setPick] = useState(tries.length - 1);
  const [choosing, setChoosing] = useState(false);
  // Index into the choices, or "unsure".
  const [expect, setExpect] = useState<number | "unsure" | null>(null);
  // Step 2 of 2: "What kind of input broke it?"
  const [labeling, setLabeling] = useState(false);
  const [result, setResult] = useState<BustedResult | null>(null);
  const t = tries[pick];
  // Tries saved before answer choices existed have no `correct`; fall back to what it said.
  const choices = answerChoices(machine, t.inputs, t.output.text, t.correct ?? t.output.text);

  function submit(label: StudentLabel) {
    if (expect === null) return;
    const verdict = verdictFor(t);
    const kind = verdict === "real" ? t.bugKind : null;
    const counted = verdict === "real" && kind !== null && isNewKind(kind);
    const classifierLabel = labelFor(kind, t.categories, machine);
    logEvent("busted", {
      input_n: t.n,
      inputs: t.inputs,
      output_shown: t.output.text,
      expected_options: choices.options,
      expected_choice: expect === "unsure" ? null : choices.options[expect],
      expected_unsure: expect === "unsure",
      expected_correct: expect !== "unsure" && expect === choices.correct,
      student_label: label,
      classifier_label: classifierLabel,
      label_agreement: classifierLabel === null ? null : label === classifierLabel,
      verdict,
      bug_kind: kind,
      counted,
    });
    setResult({ verdict, kind, inputs: t.inputs, counted, labelAgrees: label === classifierLabel });
  }

  if (result) {
    const bug = result.kind ? withArticle(bugLabel(machine, result.kind)) : "";
    const message =
      result.verdict === "real"
        ? result.labelAgrees
          ? `Yes, ${bug} bug! 🎉`
          : `We'd call that ${bug} bug 🎉`
        : result.verdict === "debatable"
          ? "The request doesn't say. Good thinking: what should it do?"
          : "That one works the way the request says. Keep testing!";
    return (
      <Modal label="Busted result">
        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <span className="text-7xl" aria-hidden="true">
            {result.verdict === "real" ? "💥" : result.verdict === "debatable" ? "🤔" : "🔍"}
          </span>
          <p className="text-3xl leading-snug font-bold">{message}</p>
          <BigButton onClick={() => onDone(result)}>Keep testing</BigButton>
        </div>
      </Modal>
    );
  }

  if (labeling) {
    return (
      <Modal label="Busted: what kind">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">💥 What kind of input broke it?</h2>
            <button type="button" onClick={onCancel} className="min-h-12 rounded-full px-4 text-lg font-bold text-ink-soft hover:bg-paper">
              ✕ Cancel
            </button>
          </div>
          <p className="text-xl">
            <span className="font-bold">{describeInputs(machine, t.inputs)}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            {studentLabels(machine).map((l) => (
              <OptionButton key={l.id} onClick={() => submit(l.id)}>
                {l.text}
              </OptionButton>
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal label="Busted">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">💥 Which try broke it?</h2>
          <button type="button" onClick={onCancel} className="min-h-12 rounded-full px-4 text-lg font-bold text-ink-soft hover:bg-paper">
            ✕ Cancel
          </button>
        </div>

        {choosing ? (
          <ol className="flex max-h-56 flex-col gap-2 overflow-y-auto">
            {[...tries].reverse().map((tr) => {
              const i = tries.indexOf(tr);
              return (
                <li key={tr.n}>
                  <OptionButton
                    selected={i === pick}
                    onClick={() => {
                      setPick(i);
                      setExpect(null);
                      setChoosing(false);
                    }}
                  >
                    {describeInputs(machine, tr.inputs)} → <span className="break-all whitespace-pre-wrap">{clean(tr.output.text)}</span>
                  </OptionButton>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border-4 border-danger/40 bg-danger/5 px-4 py-3">
            <p className="flex-1 text-xl">
              <span className="font-bold">{describeInputs(machine, t.inputs)}</span> →{" "}
              <span className="break-all whitespace-pre-wrap">{clean(t.output.text)}</span>
            </p>
            {tries.length > 1 && (
              <button type="button" onClick={() => setChoosing(true)} className="min-h-11 rounded-full px-3 text-base font-bold text-teal underline">
                Pick another try
              </button>
            )}
          </div>
        )}

        <h3 className="text-2xl font-bold">It should say…</h3>
        <div className="flex flex-col gap-2">
          {choices.options.map((o, i) => (
            <OptionButton key={o} selected={expect === i} onClick={() => setExpect(i)}>
              <span className="break-all whitespace-pre-wrap">{o.trim() === "" ? "(blank)" : clean(o)}</span>
            </OptionButton>
          ))}
          <OptionButton selected={expect === "unsure"} onClick={() => setExpect("unsure")}>
            I&apos;m not sure
          </OptionButton>
        </div>
        <BigButton onClick={() => setLabeling(true)} disabled={expect === null} className="self-end">
          Next →
        </BigButton>
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { BigButton } from "@/components/ui";
import type { SurveyQuestion } from "@/config/survey";
import { logEvent } from "@/lib/logger";
import type { BustedBug } from "@/lib/types";
import { CATEGORY_LABEL, MACHINES } from "@/machines";

// ------------------------------------------------------------- survey

export function SurveyScreen({ q, when, onAnswer }: { q: SurveyQuestion; when: "pre" | "post"; onAnswer: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-6 py-6">
      <h1 className="text-3xl leading-snug font-bold">{q.question}</h1>
      <div className="flex flex-col gap-3">
        {q.options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => {
              logEvent("survey_response", { question: q.id, when, choice: o.id, text: o.text });
              onAnswer();
            }}
            className="flex min-h-16 items-center gap-4 rounded-2xl border-4 border-line bg-white px-5 py-2 text-left text-xl hover:border-teal"
          >
            {o.letter && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal text-lg font-bold text-white">{o.letter}</span>
            )}
            {o.text}
          </button>
        ))}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- end

export function kindsFound(busted: BustedBug[]): string[] {
  return [...new Set(busted.map((b) => CATEGORY_LABEL[b.kind]))];
}

export function EndScreen({
  busted,
  bonusDone,
  onBonus,
  onFinish,
}: {
  busted: BustedBug[];
  bonusDone: boolean;
  onBonus: () => void;
  onFinish: () => void;
}) {
  const kinds = kindsFound(busted);
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-5 px-6 py-6 text-center">
      <span className="text-8xl" aria-hidden="true">
        💥
      </span>
      <h1 className="text-4xl font-bold">
        You busted {busted.length} {busted.length === 1 ? "bug" : "bugs"}!
      </h1>
      {kinds.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {kinds.map((k) => (
            <span key={k} className="rounded-full bg-amber-soft px-4 py-1 text-xl font-bold">
              {k}
            </span>
          ))}
        </div>
      )}
      <p className="text-2xl">Thank you for testing the AI&apos;s tools!</p>
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        {!bonusDone && (
          <BigButton variant="secondary" onClick={onBonus}>
            ⭐ Bonus challenge
          </BigButton>
        )}
        <BigButton onClick={onFinish}>I&apos;m finished</BigButton>
      </div>
    </main>
  );
}

// ------------------------------------------------------ guilty line

/** Bonus: for one real bug, which line of the machine's code caused it? */
export function GuiltyLine({ bug, onNext, last }: { bug: BustedBug; onNext: () => void; last: boolean }) {
  const machine = MACHINES[bug.machine];
  const answer = machine.guiltyLine(bug.kind, bug.inputs);
  const [chosen, setChosen] = useState<number | "missing" | null>(null);

  function choose(c: number | "missing") {
    if (chosen !== null) return;
    setChosen(c);
    logEvent("guilty_line_attempt", { bug_machine: bug.machine, bug_kind: bug.kind, inputs: bug.inputs, line_chosen: c, correct_line: answer, correct: c === answer });
  }

  const shown = machine.fields.map((f) => `${f.label}: ${bug.inputs[f.id] === "" ? "(empty)" : `"${bug.inputs[f.id]}"`}`).join(", ");
  const line = (c: number | "missing") =>
    chosen === null
      ? "border-line bg-white hover:border-teal"
      : c === answer
        ? "border-teal bg-teal text-white"
        : c === chosen
          ? "border-danger bg-danger/10"
          : "border-line bg-white opacity-60";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-5">
      <h1 className="text-3xl leading-snug font-bold">
        {machine.icon} Which line made the {CATEGORY_LABEL[bug.kind]} bug in {machine.name}?
      </h1>
      <p className="text-xl text-ink-soft">You found it with {shown}.</p>
      <ol className="flex flex-col gap-2">
        {machine.pseudocode.map((code, i) => (
          <li key={code}>
            <button
              type="button"
              onClick={() => choose(i + 1)}
              className={`flex min-h-14 w-full items-center gap-4 rounded-2xl border-4 px-4 text-left font-mono text-xl ${line(i + 1)}`}
            >
              <span className="w-6 text-ink-soft">{i + 1}</span>
              {code}
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => choose("missing")} className={`flex min-h-14 w-full items-center gap-4 rounded-2xl border-4 px-4 text-left text-xl font-bold ${line("missing")}`}>
            <span className="w-6" aria-hidden="true">
              ➕
            </span>
            A line is missing
          </button>
        </li>
      </ol>
      {chosen !== null && (
        <div className="flex items-center gap-4">
          <p className="flex-1 text-2xl font-bold">
            {chosen === answer
              ? "🎉 Yes! You found the guilty line."
              : answer === "missing"
                ? "Good try! A check is missing. The code never checks for this."
                : `Good try! It was line ${answer}.`}
          </p>
          <BigButton onClick={onNext}>{last ? "Done" : "Next bug →"}</BigButton>
        </div>
      )}
    </main>
  );
}

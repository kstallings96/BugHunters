"use client";

import { useState } from "react";
import { BigButton } from "@/components/ui";
import type { SurveyQuestion } from "@/config/survey";
import { logEvent } from "@/lib/logger";
import type { BustedBug } from "@/lib/types";
import { RAFFLE } from "@/bonus/raffle";
import { bugLabel, MACHINES } from "@/machines";

// ------------------------------------------------------------- intake

/** One intake question; the answer is logged as its 1-based position. */
export function SurveyScreen({ q, onAnswer }: { q: SurveyQuestion; onAnswer: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-6 py-6">
      <h1 className="text-3xl leading-snug font-bold">{q.question}</h1>
      <div className="flex flex-col gap-3">
        {q.options.map((text, i) => (
          <button
            key={text}
            type="button"
            onClick={() => {
              logEvent("survey_response", { question: q.id, choice: i + 1, text });
              onAnswer();
            }}
            className="flex min-h-16 items-center rounded-2xl border-4 border-line bg-white px-5 py-2 text-left text-xl hover:border-teal"
          >
            {text}
          </button>
        ))}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- end

export function kindsFound(busted: BustedBug[]): string[] {
  return [...new Set(busted.map((b) => bugLabel(b.machine, b.kind)))];
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
      {busted.length > 0 && <p className="text-2xl">The AI said its tools worked perfectly. You proved it wrong.</p>}
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

/**
 * Bonus: for one real bug, either pick the line that's wrong, or, when a
 * check is missing, pick which line fills the gap. Every answer is a choice
 * on screen.
 */
export function GuiltyLine({ bug, onNext, last }: { bug: BustedBug; onNext: () => void; last: boolean }) {
  const machine = bug.machine === "raffle" ? RAFFLE : MACHINES[bug.machine];
  const fix = machine.fixFor(bug.kind, bug.inputs);
  const [chosen, setChosen] = useState<number | null>(null);
  const answer = fix.type === "wrong_line" ? fix.line : fix.answer;

  function choose(c: number) {
    if (chosen !== null) return;
    setChosen(c);
    logEvent("guilty_line_attempt", {
      bug_machine: bug.machine,
      bug_kind: bug.kind,
      inputs: bug.inputs,
      question: fix.type,
      chosen: c,
      chosen_text: fix.type === "wrong_line" ? machine.pseudocode[c - 1] : fix.options[c],
      answer,
      correct: c === answer,
    });
  }

  const look = (c: number) =>
    chosen === null
      ? "border-line bg-white hover:border-teal"
      : c === answer
        ? "border-teal bg-teal text-white"
        : c === chosen
          ? "border-danger bg-danger/10"
          : "border-line bg-white opacity-60";

  const shown = machine.fields.map((f) => `${f.label}: ${bug.inputs[f.id] === "" ? "(empty)" : `"${bug.inputs[f.id]}"`}`).join(", ");
  const filled = fix.type === "missing_line" && chosen !== null ? fix.options[fix.answer] : null;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-4 px-6 py-5">
      <h1 className="text-3xl leading-snug font-bold">
        {machine.icon} {fix.type === "wrong_line" ? "Which line made" : "A line is missing! Which one fixes"} the {bugLabel(bug.machine, bug.kind)} bug in{" "}
        {machine.name}?
      </h1>
      <p className="text-xl text-ink-soft">
        You found it with {shown}. <span className="text-base">(A simplified view of the AI&apos;s code.)</span>
      </p>

      {fix.type === "wrong_line" ? (
        <ol className="flex flex-col gap-2">
          {machine.pseudocode.map((code, i) => (
            <li key={code}>
              <button
                type="button"
                onClick={() => choose(i + 1)}
                className={`flex min-h-14 w-full items-center gap-4 rounded-2xl border-4 px-4 text-left font-mono text-xl ${look(i + 1)}`}
              >
                <span className="w-6 opacity-60">{i + 1}</span>
                {code}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <ol className="flex flex-col gap-1 rounded-2xl border-2 border-line bg-white p-3 font-mono text-lg">
            {machine.pseudocode.map((code, i) => (
              <li key={code} className="flex flex-col gap-1">
                {i === fix.after && <GapLine filled={filled} />}
                <span>{code}</span>
              </li>
            ))}
            {fix.after >= machine.pseudocode.length && <GapLine filled={filled} />}
          </ol>
          <div className="flex flex-col gap-2">
            {fix.options.map((o, i) => (
              <button
                key={o}
                type="button"
                onClick={() => choose(i)}
                className={`flex min-h-14 w-full items-center rounded-2xl border-4 px-4 text-left font-mono text-lg ${look(i)}`}
              >
                {o}
              </button>
            ))}
          </div>
        </>
      )}

      {chosen !== null && (
        <div className="flex items-center gap-4">
          <p className="flex-1 text-2xl font-bold">
            {chosen === answer ? "🎉 Yes! That's it." : fix.type === "wrong_line" ? `Good try! It was line ${answer}.` : "Good try! The green line fixes it."}
          </p>
          <BigButton onClick={onNext}>{last ? "Done" : "Next bug →"}</BigButton>
        </div>
      )}
    </main>
  );
}

function GapLine({ filled }: { filled: string | null }) {
  return filled ? (
    <span className="rounded-lg bg-teal/15 px-2 font-bold text-teal">➕ {filled}</span>
  ) : (
    <span className="rounded-lg border-2 border-dashed border-amber bg-amber-soft px-2 font-bold">➕ ____________ ?</span>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { BigButton } from "@/components/ui";
import type { SurveyQuestion } from "@/config/survey";
import { clean } from "@/lib/clean";
import { logEvent } from "@/lib/logger";
import type { BustedBug } from "@/lib/types";
import { RAFFLE } from "@/bonus/raffle";
import { bugLabel, MACHINES } from "@/machines";

// ------------------------------------------------------------- intake

/** One intake item; the answer is logged as 1 (lowest) to 5 (highest). Every choice has an example. */
export function SurveyScreen({ q, onAnswer }: { q: SurveyQuestion; onAnswer: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-6 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl leading-snug font-bold">{q.question}</h1>
        <p className="text-xl text-ink-soft">{q.examples}</p>
      </div>
      <div className="grid grid-cols-5 gap-3" role="group" aria-label={q.question}>
        {q.choices.map((c, i) => (
          <button
            key={c.label}
            type="button"
            onClick={() => {
              logEvent("survey_response", { question: q.id, choice: i + 1, text: c.label, scale: q.choices.length });
              onAnswer();
            }}
            className="flex min-h-40 flex-col items-center justify-start gap-1 rounded-2xl border-4 border-line bg-white px-2 py-3 text-center hover:border-teal"
          >
            <span className="text-3xl font-bold text-teal" aria-hidden="true">
              {i + 1}
            </span>
            <span className="text-xl leading-tight font-bold">{c.label}</span>
            <span className="text-base leading-snug text-ink-soft">{c.example}</span>
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
  leaderboard,
}: {
  busted: BustedBug[];
  bonusDone: boolean;
  onBonus: () => void;
  onFinish: () => void;
  /** The class leaderboard, beside the results. */
  leaderboard?: ReactNode;
}) {
  const kinds = kindsFound(busted);
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[1fr_auto] items-center gap-6 px-6 py-6">
      <div className="flex flex-col items-center justify-center gap-5 text-center">
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
      </div>
      {leaderboard && <div className="w-[24rem] self-center">{leaderboard}</div>}
    </main>
  );
}

// ------------------------------------------------------ guilty line

/**
 * Bonus code question for one real bug, in two parts. Find it: tap the line
 * that's wrong, or say a check is missing. Fix it: pick the right line from
 * four, where the wrong ones are near misses. Every answer is a choice on
 * screen, and the student can leave the code questions at any time.
 */
export function GuiltyLine({
  bug,
  onNext,
  onSkip,
  index,
  total,
}: {
  bug: BustedBug;
  onNext: () => void;
  /** Leave the code questions now. */
  onSkip: () => void;
  index: number;
  total: number;
}) {
  const last = index >= total - 1;
  const machine = bug.machine === "raffle" ? RAFFLE : MACHINES[bug.machine];
  const fix = machine.fixFor(bug.kind, bug.inputs);
  // Part 1: a line number, or 0 for "a check is missing".
  const [found, setFound] = useState<number | null>(null);
  const [fixed, setFixed] = useState<number | null>(null);
  const target = fix.type === "wrong_line" ? fix.line : 0;
  const foundRight = found === target;

  function find(choice: number) {
    if (found !== null) return;
    setFound(choice);
  }

  function choose(c: number) {
    if (fixed !== null || found === null) return;
    setFixed(c);
    logEvent("guilty_line_attempt", {
      bug_machine: bug.machine,
      bug_kind: bug.kind,
      inputs: bug.inputs,
      question: fix.type,
      find_choice: found === 0 ? "missing" : found,
      find_answer: target === 0 ? "missing" : target,
      find_correct: foundRight,
      fix_options: fix.options,
      fix_choice: c,
      fix_choice_text: fix.options[c],
      fix_answer: fix.answer,
      fix_correct: c === fix.answer,
      // Kept for older exports: the whole question right.
      correct: foundRight && c === fix.answer,
    });
  }

  const shown = machine.fields.map((f) => `${f.label}: ${bug.inputs[f.id] === "" ? "(empty)" : `"${clean(bug.inputs[f.id])}"`}`).join(", ");
  const lineLook = (n: number) =>
    found === null
      ? "border-line bg-white hover:border-teal"
      : n === target
        ? "border-teal bg-teal/15 font-bold"
        : n === found
          ? "border-danger bg-danger/10"
          : "border-line bg-white opacity-60";
  const optionLook = (c: number) =>
    fixed === null
      ? "border-line bg-white hover:border-teal"
      : c === fix.answer
        ? "border-teal bg-teal text-white"
        : c === fixed
          ? "border-danger bg-danger/10"
          : "border-line bg-white opacity-60";

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-lg font-bold text-ink-soft">
          ⭐ Code question {index + 1} of {total}
        </p>
        <button
          type="button"
          onClick={() => {
            logEvent("guilty_line_skip", { at: index + 1, of: total, answered: fixed !== null });
            onSkip();
          }}
          className="min-h-12 rounded-full border-2 border-line px-4 text-lg font-bold text-ink-soft hover:bg-paper"
        >
          I&apos;m done with code questions →
        </button>
      </div>
      <h1 className="text-3xl leading-snug font-bold">
        {machine.icon} What caused the {bugLabel(bug.machine, bug.kind)} bug in {machine.name}?
      </h1>
      <p className="text-lg text-ink-soft">
        You found it with {shown}. Here&apos;s the AI&apos;s code, in plain words.
        {bug.machine === "raffle" && " (Spots count from 0: names[0] is the first name.)"}
      </p>

      <div className="grid grid-cols-[1.1fr_1fr] gap-5">
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">1. Find it: which line is wrong?</h2>
          <ol className="flex flex-col gap-1.5">
            {machine.pseudocode.map((code, i) => (
              <li key={code} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => find(i + 1)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border-4 px-3 text-left font-mono text-base leading-snug ${lineLook(i + 1)}`}
                >
                  <span className="w-5 opacity-60">{i + 1}</span>
                  {code}
                </button>
                {fix.type === "missing_line" && fixed !== null && i + 1 === fix.after && (
                  <span className="rounded-lg bg-teal/15 px-3 py-1 font-mono text-base font-bold text-teal">➕ {fix.options[fix.answer]}</span>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => find(0)}
            className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border-4 border-dashed px-3 text-left text-lg ${lineLook(0)}`}
          >
            ➕ No line is wrong. A check is missing.
          </button>
          {found !== null && (
            <p className="text-lg font-bold">
              {foundRight
                ? "✅ Yes!"
                : fix.type === "wrong_line"
                  ? `Not quite: line ${fix.line} is the problem.`
                  : `Not quite: every line does its job. A check is missing after line ${fix.after}.`}
            </p>
          )}
        </section>

        <section className={`flex flex-col gap-2 ${found === null ? "opacity-40" : ""}`}>
          <h2 className="text-xl font-bold">
            {/* Naming the line before part 1 is answered would give it away. */}
            2. Fix it{found === null ? "" : fix.type === "wrong_line" ? `: line ${fix.line} should say…` : `: add which check after line ${fix.after}?`}
          </h2>
          {/* The choices stay hidden until part 1 is answered: their shape (four "if" checks, or four versions of one line) would give it away. */}
          {found === null && <p className="text-base text-ink-soft">Find it first.</p>}
          <div className={`flex flex-col gap-1.5 ${found === null ? "hidden" : ""}`}>
            {fix.options.map((o, i) => (
              <button
                key={o}
                type="button"
                disabled={found === null}
                onClick={() => choose(i)}
                className={`flex min-h-12 w-full items-center rounded-2xl border-4 px-3 py-1 text-left font-mono text-base leading-snug ${optionLook(i)}`}
              >
                {o}
              </button>
            ))}
          </div>
          {fixed !== null && (
            <div className="flex flex-col gap-2 pt-1">
              <p className="text-xl font-bold">{fixed === fix.answer ? "🎉 Yes! That fixes it." : "Close! The green one fixes it for every input, not just yours."}</p>
              <BigButton onClick={onNext} className="self-end">
                {last ? "Done" : "Next bug →"}
              </BigButton>
            </div>
          )}
        </section>
      </div>

    </main>
  );
}

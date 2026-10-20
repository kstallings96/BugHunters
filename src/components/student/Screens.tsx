"use client";

import { useState, type ReactNode } from "react";
import { BigButton } from "@/components/ui";
import type { SurveyQuestion } from "@/config/survey";
import { clean } from "@/lib/clean";
import { logEvent } from "@/lib/logger";
import type { BustedBug } from "@/lib/types";
import { RAFFLE } from "@/bonus/raffle";
import { bugLabel, evaluate, MACHINES } from "@/machines";

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
            Bonus challenge
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
 * Bonus code question for one bug, in two parts, depending on the bug:
 *   A line is wrong:     1. which line made that happen?  2. pick its fixed version.
 *   A check is missing:  1. which check is missing?        2. where does it go?
 * Wrong choices are near misses. Every answer is a choice on screen, and the
 * student can leave the code questions at any time.
 */
export function GuiltyLine({
  bug,
  found: studentFound,
  onNext,
  onSkip,
  index,
  total,
}: {
  bug: BustedBug;
  /** A bug the student found, or one they missed (shown with its example input). */
  found: boolean;
  onNext: () => void;
  /** Leave the code questions now. */
  onSkip: () => void;
  index: number;
  total: number;
}) {
  const last = index >= total - 1;
  const machine = bug.machine === "raffle" ? RAFFLE : MACHINES[bug.machine];
  const fix = machine.fixFor(bug.kind, bug.inputs);
  const missing = fix.type === "missing_line";
  // Part 1: a line (wrong line) or a check (missing). Part 2: a fixed line, or a spot (gap after line N).
  const [first, setFirst] = useState<number | null>(null);
  const [second, setSecond] = useState<number | null>(null);
  const firstRight = first !== null && (missing ? first === fix.answer : first === fix.line);
  const secondRight = second !== null && (missing ? fix.validAfter.includes(second) : second === fix.answer);

  function answerSecond(choice: number) {
    if (first === null || second !== null) return;
    setSecond(choice);
    const right = missing ? fix.validAfter.includes(choice) : choice === fix.answer;
    logEvent("guilty_line_attempt", {
      bug_machine: bug.machine,
      bug_kind: bug.kind,
      inputs: bug.inputs,
      question: fix.type,
      // A bug the student found, or one they missed (code questions fill in with those).
      bug_found: studentFound,
      fix_options: fix.options,
      ...(missing
        ? {
            fix_choice: first,
            fix_choice_text: fix.options[first],
            fix_correct: first === fix.answer,
            place_choice: choice,
            place_valid: fix.validAfter,
            place_correct: right,
          }
        : {
            find_choice: first,
            find_answer: fix.line,
            find_correct: first === fix.line,
            fix_choice: choice,
            fix_choice_text: fix.options[choice],
            fix_correct: right,
          }),
      correct: firstRight && right,
    });
  }

  const shown = machine.fields.map((f) => `${f.label.replace(/\s*\(.*\)$/, "")}: ${bug.inputs[f.id] === "" ? "(empty)" : `"${clean(bug.inputs[f.id])}"`}`).join(", ");
  const example = exampleOf(bug);
  const look = (state: "idle" | "right" | "wrong" | "dim") =>
    ({
      idle: "border-line bg-white hover:border-teal",
      right: "border-teal bg-teal text-white",
      wrong: "border-danger bg-danger/10",
      dim: "border-line bg-white opacity-60",
    })[state];
  const optionState = (i: number, chosen: number | null, answer: number) =>
    chosen === null ? "idle" : i === answer ? "right" : i === chosen ? "wrong" : "dim";

  const options = (chosen: number | null, onPick: (i: number) => void, disabled = false) => (
    <div className="flex flex-col gap-1.5">
      {fix.options.map((o, i) => (
        <button
          key={o}
          type="button"
          disabled={disabled || chosen !== null}
          onClick={() => onPick(i)}
          className={`flex min-h-12 w-full items-center rounded-2xl border-4 px-3 py-1 text-left font-mono text-base leading-snug ${look(optionState(i, chosen, fix.answer))}`}
        >
          {o}
        </button>
      ))}
    </div>
  );

  const lastGap = machine.pseudocode.length;
  const range = missing ? `between line ${fix.validAfter[0]} and ${fix.validAfter.at(-1)! + 1 > lastGap ? "the end" : `line ${fix.validAfter.at(-1)! + 1}`}` : "";

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-lg font-bold text-ink-soft">
          Code question {index + 1} of {total}
        </p>
        <button
          type="button"
          onClick={() => {
            logEvent("guilty_line_skip", { at: index + 1, of: total, answered: second !== null });
            onSkip();
          }}
          className="min-h-12 rounded-full border-2 border-line px-4 text-lg font-bold text-ink-soft hover:bg-paper"
        >
          I&apos;m done with code questions →
        </button>
      </div>
      <h1 className="text-3xl leading-snug font-bold">
        {machine.icon} A bug you {studentFound ? "found" : "didn't find"} in {machine.name}: {bugLabel(bug.machine, bug.kind)}
      </h1>
      <div className="rounded-2xl border-2 border-line bg-card px-4 py-2 text-lg leading-snug">
        {example ? (
          <>
            You type <b>{shown}</b>. It says <b className="text-danger">{example.said}</b>
            {stop(example.said)} It should say <b className="text-teal">{example.should}</b>
            {stop(example.should)}
          </>
        ) : (
          raffleExample(bug)
        )}{" "}
        {missing ? "The AI's code never checks for this." : "One line of the AI's code is wrong."}
      </div>

      {missing ? (
        <div className="grid grid-cols-[1fr_1.1fr] gap-5">
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">1. Which check is missing?</h2>
            {options(first, setFirst)}
            {first !== null && <p className="text-lg font-bold">{firstRight ? "Yes!" : "Not that one. The green check is the one it needs."}</p>}
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">2. Where should it go?</h2>
            <p className="text-base text-ink-soft">
              {first === null ? "Pick the check first." : "Tap a spot in the AI's code."}
              {bug.machine === "raffle" && " Spots count from 0: names[0] is the first name."}
            </p>
            <ol className="flex flex-col">
              {Array.from({ length: lastGap + 1 }, (_, gap) => (
                <li key={gap} className="flex flex-col">
                  {second === null ? (
                    <button
                      type="button"
                      disabled={first === null}
                      onClick={() => answerSecond(gap)}
                      aria-label={gap === 0 ? "Before line 1" : `After line ${gap}`}
                      className="my-0.5 min-h-9 rounded-lg border-2 border-dashed border-amber/70 px-3 text-left text-sm font-bold text-ink-soft enabled:hover:bg-amber-soft disabled:opacity-30"
                    >
                      + here
                    </button>
                  ) : gap === second || (!secondRight && gap === fix.after) ? (
                    <span
                      className={`my-0.5 rounded-lg px-3 py-1 font-mono text-base font-bold ${
                        fix.validAfter.includes(gap) ? "bg-teal/15 text-teal" : "bg-danger/10 text-danger line-through"
                      }`}
                    >
                      + {fix.options[fix.answer]}
                    </span>
                  ) : (
                    <span className="h-1.5" />
                  )}
                  {gap < lastGap && (
                    <span className="flex items-center gap-3 rounded-xl border-2 border-line bg-white px-3 py-1.5 font-mono text-base leading-snug">
                      <span className="w-5 opacity-60">{gap + 1}</span>
                      {machine.pseudocode[gap]}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-[1.1fr_1fr] gap-5">
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">1. Which line made that happen?</h2>
            {bug.machine === "raffle" && <p className="text-base text-ink-soft">Spots count from 0: names[0] is the first name.</p>}
            <ol className="flex flex-col gap-1.5">
              {machine.pseudocode.map((code, i) => (
                <li key={code}>
                  <button
                    type="button"
                    disabled={first !== null}
                    onClick={() => setFirst(i + 1)}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-2xl border-4 px-3 text-left font-mono text-base leading-snug ${look(
                      first === null ? "idle" : i + 1 === fix.line ? "right" : i + 1 === first ? "wrong" : "dim",
                    )}`}
                  >
                    <span className="w-5 opacity-60">{i + 1}</span>
                    {code}
                  </button>
                </li>
              ))}
            </ol>
            {first !== null && <p className="text-lg font-bold">{firstRight ? "Yes!" : `Not quite. It's line ${fix.line}.`}</p>}
          </section>
          <section className="flex flex-col gap-2">
            {/* Naming the line before part 1 is answered would give it away. */}
            <h2 className="text-xl font-bold">2. {first === null ? "Fix it" : `Pick the fixed line ${fix.line}:`}</h2>
            {first === null ? <p className="text-base text-ink-soft">Find the line first.</p> : options(second, answerSecond)}
          </section>
        </div>
      )}

      {second !== null && (
        <div className="flex items-center gap-4">
          <p className="flex-1 text-xl font-bold">
            {missing
              ? secondRight
                ? "Yes! The check works there."
                : `Not there. It has to go ${range}: after the code has what it needs to check, and before the answer.`
              : secondRight
                ? "Yes! That fixes it."
                : "Not that one. The green one fixes it."}
          </p>
          <BigButton onClick={onNext}>{last ? "Done" : "Next bug →"}</BigButton>
        </div>
      )}
    </main>
  );
}

/** A full stop after quoted output, unless it already ends a sentence. */
const stop = (text: string) => (/[.!?]$/.test(text) ? "" : ".");

/** What the app said and should say for this bug's input (the three apps; the raffle is random). */
function exampleOf(bug: BustedBug): { said: string; should: string } | null {
  if (bug.machine === "raffle") return null;
  const e = evaluate(MACHINES[bug.machine], bug.inputs, { today: new Date() });
  const text = (t: string) => (t.trim() === "" ? "(blank)" : clean(t));
  return { said: text(e.buggy.text), should: text(e.reference.text) };
}

function raffleExample(bug: BustedBug): string {
  const names = (bug.inputs.names ?? "").split("\n").map((n) => n.trim()).filter(Boolean);
  if (bug.kind === "off_by_one") return `You picked 20 times from ${names.join(", ")}. ${names.at(-1) ?? "The last name"} never won.`;
  return "With only one name, it still picked a winner. A raffle needs at least 2.";
}

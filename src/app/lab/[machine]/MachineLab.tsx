"use client";

import Link from "next/link";
import { useState } from "react";
import { blankInputs, MachineCard } from "@/components/MachineCard";
import { answerChoices, CATEGORY_LABEL, evaluate, MACHINES, verdictFor, type Evaluation, type Inputs, type MachineId } from "@/machines";

export function MachineLab({ id }: { id: MachineId }) {
  const machine = MACHINES[id];
  const [values, setValues] = useState<Inputs>(() => blankInputs(machine));
  const [result, setResult] = useState<{ inputs: Inputs; e: Evaluation } | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 py-4">
      <nav className="flex flex-wrap gap-2 text-base">
        <span className="font-bold">Lab:</span>
        {(Object.keys(MACHINES) as MachineId[]).map((m) => (
          <Link key={m} href={`/lab/${m}`} className={`rounded-full px-3 py-0.5 ${m === id ? "bg-ink text-white" : "underline"}`}>
            {MACHINES[m].name}
          </Link>
        ))}
      </nav>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        <MachineCard
          machine={machine}
          values={values}
          onChange={setValues}
          onTry={() => setResult({ inputs: values, e: evaluate(machine, values, { today: new Date() }) })}
          output={result?.e.buggy ?? null}
        />
        <section className="flex flex-col gap-2 rounded-3xl border-2 border-line bg-card p-5 text-base">
          <h2 className="text-xl font-bold">Scoring (staff only)</h2>
          {result ? (
            <>
              <p>
                <b>Input:</b> <code className="whitespace-pre">{JSON.stringify(result.inputs)}</code>
              </p>
              <p>
                <b>Categories:</b> {result.e.categories.map((c) => CATEGORY_LABEL[c]).join(", ")}
              </p>
              <p>
                <b>Buggy:</b> <span className="whitespace-pre">{result.e.buggy.text}</span>
              </p>
              <p>
                <b>Reference:</b> <span className="whitespace-pre">{result.e.reference.text}</span>
                {result.e.reference.type === "not_allowed" && ` (refuses: ${CATEGORY_LABEL[result.e.reference.rule]})`}
              </p>
              <p>
                <b>Busted! would be:</b> {verdictFor(result.e)}
                {result.e.bugKind && ` · ${CATEGORY_LABEL[result.e.bugKind]} bug`}
              </p>
              <p>
                <b>&ldquo;It should say&rdquo; choices:</b>{" "}
                {answerChoices(machine, result.inputs, result.e.buggy.text, result.e.reference.text)
                  .options.map((o) => (o === result.e.reference.text ? `✔ ${o}` : o))
                  .join("  |  ")}
              </p>
              {result.e.bugKind &&
                (() => {
                  const fix = machine.fixFor(result.e.bugKind, result.inputs);
                  return (
                    <p>
                      <b>Bonus fix:</b>{" "}
                      {fix.type === "wrong_line" ? `line ${fix.line} should be: ${fix.options[fix.answer]}` : `missing after line ${fix.after}: ${fix.options[fix.answer]}`}
                    </p>
                  );
                })()}
            </>
          ) : (
            <p className="text-ink-soft">Try an input to see how it is scored.</p>
          )}
          <h3 className="mt-2 font-bold">Pseudocode</h3>
          <ol className="list-decimal pl-6 font-mono text-sm">
            {machine.pseudocode.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

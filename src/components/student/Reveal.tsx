"use client";

import { useEffect, useRef } from "react";
import { BigButton } from "@/components/ui";
import { AI_TESTS, AI_TESTS_SOURCE, shownExpectation } from "@/config/aiTests";
import { logEvent } from "@/lib/logger";
import type { BustedBug } from "@/lib/types";
import { bugLabel, categorize, MACHINES, type MachineId } from "@/machines";

/**
 * The missed-bug reveal: kinds the student found ✓, kinds still hiding with
 * one example each, and the AI's own tests beside them.
 */

function split(machine: MachineId, busted: BustedBug[]) {
  const found = new Set(busted.filter((b) => b.machine === machine).map((b) => b.kind));
  const bugs = MACHINES[machine].bugs;
  return { found: bugs.filter((b) => found.has(b.kind)), hiding: bugs.filter((b) => !found.has(b.kind)) };
}

function describeInputs(machine: MachineId, inputs: Record<string, string>): string {
  const shown = (raw: string) => (raw === "" ? "(empty)" : raw);
  // "Price: 100, Saved per week: 20" (labels without their "($)").
  const label = (text: string) => text.replace(/\s*\(.*\)$/, "");
  return MACHINES[machine].fields.map((f) => (MACHINES[machine].fields.length > 1 ? `${label(f.label)}: ${shown(inputs[f.id])}` : shown(inputs[f.id]))).join(", ");
}

/** True when every AI test used only ordinary inputs (so we can say so). */
function onlyOrdinary(machine: MachineId): boolean {
  const tests = AI_TESTS[machine] ?? [];
  return tests.length > 0 && tests.every((t) => categorize(MACHINES[machine], t.inputs, { today: new Date() }).join() === "normal");
}

function useLogOnce(payload: Record<string, unknown>) {
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logEvent("reveal_view", payload);
    // Logged once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Reveal for one app, shown right after it (reveal condition). */
export function MachineReveal({ machine, busted, last, onNext }: { machine: MachineId; busted: BustedBug[]; last: boolean; onNext: () => void }) {
  const m = MACHINES[machine];
  const { found, hiding } = split(machine, busted);
  const tests = AI_TESTS[machine] ?? [];
  const allFound = hiding.length === 0 && found.length > 0;
  useLogOnce({ scope: "machine", reveal_machine: machine, found: found.map((b) => b.kind), missed: hiding.map((b) => b.kind), all_found: allFound });

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 px-6 py-3">
      <h1 className="text-3xl font-bold">
        {m.icon} {m.name}: what was hiding?
      </h1>
      {/* Only here, after the app: saying it while they test would tell them when to stop. */}
      {allFound && <AllFound name={m.name} />}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.4fr] gap-5">
        <section className="flex min-h-0 flex-col gap-2 rounded-3xl border-2 border-[#475569] bg-[#f1f5f9] p-4">
          <h2 className="text-xl font-bold">{AI_TESTS_SOURCE === "generated" ? "Here's what the AI tested." : "Tests an AI might write (example)"}</h2>
          {/* The model wrote up to 9 tests: the list scrolls so Next always fits on a Chromebook. */}
          <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
            {tests.map((t) => (
              <li key={JSON.stringify(t.inputs)} className="rounded-xl bg-white px-3 py-1 text-base leading-snug">
                {describeInputs(machine, t.inputs)} → {shownExpectation(t.expects).trim() === "" ? "(blank)" : shownExpectation(t.expects)} ✓
              </li>
            ))}
          </ul>
          {onlyOrdinary(machine) && <p className="mt-auto text-lg font-bold">The AI only tried ordinary inputs.</p>}
        </section>
        <section className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-3xl border-2 border-line bg-card p-4">
          <h2 className="text-xl font-bold">Here&apos;s what you found.</h2>
          <BugList found={found.map((b) => bugLabel(machine, b.kind))} hiding={hiding.map((b) => ({ label: bugLabel(machine, b.kind), tryThis: b.tryThis }))} />
        </section>
      </div>
      <BigButton onClick={onNext} className="self-end">
        {last ? "Code questions →" : "Next app →"}
      </BigButton>
    </main>
  );
}

/** Reveal for all three apps at once, after the last one (end-only condition). */
export function FullReveal({ machines, busted, onNext }: { machines: MachineId[]; busted: BustedBug[]; onNext: () => void }) {
  const parts = machines.map((id) => ({ id, ...split(id, busted) }));
  useLogOnce({
    scope: "all",
    found: Object.fromEntries(parts.map((p) => [p.id, p.found.map((b) => b.kind)])),
    missed: Object.fromEntries(parts.map((p) => [p.id, p.hiding.map((b) => b.kind)])),
    all_found: parts.filter((p) => p.hiding.length === 0 && p.found.length > 0).map((p) => p.id),
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 px-6 py-4">
      <h1 className="text-3xl font-bold">Here&apos;s what was hiding in each app.</h1>
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
        {parts.map((p) => (
          <section key={p.id} className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-3xl border-2 border-line bg-card p-3">
            <h2 className="text-xl font-bold">
              {MACHINES[p.id].icon} {MACHINES[p.id].name}
            </h2>
            {p.hiding.length === 0 && p.found.length > 0 && (
              <p className="rounded-xl border-2 border-teal bg-teal/10 px-3 py-1 text-base font-bold text-teal">You found every bug in this app!</p>
            )}
            <BugList compact found={p.found.map((b) => bugLabel(p.id, b.kind))} hiding={p.hiding.map((b) => ({ label: bugLabel(p.id, b.kind), tryThis: b.tryThis }))} />
          </section>
        ))}
      </div>
      {machines.every(onlyOrdinary) && <p className="text-lg">The AI&apos;s own tests only tried ordinary inputs.</p>}
      <BigButton onClick={onNext} className="self-end">
        Code questions →
      </BigButton>
    </main>
  );
}

/** The banner for finding every bug the AI left in one app. */
function AllFound({ name }: { name: string }) {
  return (
    <p className="rounded-2xl border-4 border-teal bg-teal/10 px-5 py-2 text-2xl font-bold text-teal" role="status">
      You found every bug the AI left in {name}!
    </p>
  );
}

function BugList({ found, hiding, compact = false }: { found: string[]; hiding: { label: string; tryThis: string }[]; compact?: boolean }) {
  const size = compact ? "text-base" : "text-lg";
  return (
    <ul className="flex flex-col gap-1.5">
      {found.map((label) => (
        <li key={label} className={`rounded-xl bg-teal/10 px-3 py-1 font-bold ${size}`}>
          ✓ {label}: you found it!
        </li>
      ))}
      {hiding.map((h) => (
        <li key={h.label} className={`rounded-xl border-2 border-dashed border-amber bg-amber-soft/50 px-3 py-1 leading-snug ${size}`}>
          <span className="font-bold">{h.label}</span>: {h.tryThis}
        </li>
      ))}
    </ul>
  );
}

/** Between apps in the end-only condition: no feedback, just move on. */
export function NextApp({ onNext }: { onNext: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-6 py-6 text-center">
      <h1 className="text-4xl font-bold">Next app!</h1>
      <BigButton onClick={onNext}>Next app →</BigButton>
    </main>
  );
}

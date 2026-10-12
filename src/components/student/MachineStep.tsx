"use client";

import { useEffect, useState, type ReactNode } from "react";
import { blankInputs, MachineCard } from "@/components/MachineCard";
import { BigButton, Modal, OptionButton } from "@/components/ui";
import { logEvent } from "@/lib/logger";
import { CATEGORY_LABEL, evaluate, verdictFor, withArticle, type BustedVerdict, type Category, type Inputs, type Machine } from "@/machines";
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
      const raw = inputs[f.id] ?? "";
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
}) {
  const [values, setValues] = useState<Inputs>(() => blankInputs(machine));
  const [bustOpen, setBustOpen] = useState(false);
  const [nudge, setNudge] = useState<"hidden" | "shown" | "dismissed">("hidden");
  const last = tries.at(-1) ?? null;

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
          disabled={locked}
        />
      </div>

      <aside className="flex min-h-0 flex-col gap-3">
        <p className="text-lg font-bold text-ink-soft">{title}</p>
        <div className="flex min-h-0 flex-1 flex-col rounded-3xl border-2 border-line bg-card p-3">
          <p className="mb-1 text-lg font-bold">Your tries</p>
          {tries.length === 0 ? (
            <p className="text-base text-ink-soft">Nothing yet. Type something and tap Try it.</p>
          ) : (
            <ol className="flex min-h-0 flex-col gap-1 overflow-y-auto">
              {[...tries].reverse().map((t) => (
                <li key={t.n} className="rounded-xl bg-paper px-3 py-1 text-base leading-snug">
                  <span className="font-bold">{describeInputs(machine, t.inputs)}</span>
                  <span className="text-ink-soft"> → </span>
                  <span className="break-all whitespace-pre-wrap">{t.output.text}</span>
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

type Expect = "value" | "not_allowed" | "other";

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
  const [expect, setExpect] = useState<Expect | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<BustedResult | null>(null);
  const t = tries[pick];

  function submit() {
    if (!expect) return;
    const verdict = verdictFor(t);
    const kind = verdict === "real" ? t.bugKind : null;
    const counted = verdict === "real" && kind !== null && isNewKind(kind);
    logEvent("busted", {
      input_n: t.n,
      inputs: t.inputs,
      output_shown: t.output.text,
      expected_type: expect,
      expected_text: expect === "not_allowed" ? null : text.trim(),
      verdict,
      bug_kind: kind,
      counted,
    });
    setResult({ verdict, kind, inputs: t.inputs, counted });
  }

  if (result) {
    const message =
      result.verdict === "real"
        ? result.counted
          ? `Busted! You found ${withArticle(CATEGORY_LABEL[result.kind!])} bug 🎉`
          : `Busted! You already found ${withArticle(CATEGORY_LABEL[result.kind!])} bug here. Can you find a different kind?`
        : result.verdict === "debatable"
          ? "Good thinking. People might disagree about this one!"
          : "Hmm, that one works the way it should. Keep testing!";
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
                      setChoosing(false);
                    }}
                  >
                    {describeInputs(machine, tr.inputs)} → <span className="break-all whitespace-pre-wrap">{tr.output.text}</span>
                  </OptionButton>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border-4 border-danger/40 bg-danger/5 px-4 py-3">
            <p className="flex-1 text-xl">
              <span className="font-bold">{describeInputs(machine, t.inputs)}</span> →{" "}
              <span className="break-all whitespace-pre-wrap">{t.output.text}</span>
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
          <OptionButton selected={expect === "value"} onClick={() => setExpect("value")}>
            {machine.expectLabel}
          </OptionButton>
          {expect === "value" && (
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={80}
              placeholder={`Type ${machine.expectLabel} (you can skip this)`}
              aria-label={`It should say ${machine.expectLabel}`}
              className="h-14 rounded-2xl border-4 border-line bg-white px-4 text-xl outline-none focus:border-teal"
            />
          )}
          <OptionButton selected={expect === "not_allowed"} onClick={() => setExpect("not_allowed")}>
            a message saying that&apos;s not allowed
          </OptionButton>
          <OptionButton selected={expect === "other"} onClick={() => setExpect("other")}>
            something else
          </OptionButton>
          {expect === "other" && (
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={80}
              placeholder="What should it say? (you can skip this)"
              aria-label="It should say something else"
              className="h-14 rounded-2xl border-4 border-line bg-white px-4 text-xl outline-none focus:border-teal"
            />
          )}
        </div>
        <BigButton variant="danger" onClick={submit} disabled={!expect} className="self-end">
          💥 Busted!
        </BigButton>
      </div>
    </Modal>
  );
}

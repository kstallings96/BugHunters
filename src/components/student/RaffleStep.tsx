"use client";

import { useState } from "react";
import { BigButton, Modal, OptionButton } from "@/components/ui";
import { buggyPick, CLAIMS, entriesOf, judgeClaim, tally, RAFFLE, type RaffleClaim, type RaffleTry, type RaffleVerdict } from "@/bonus/raffle";
import { logEvent } from "@/lib/logger";
import type { Category } from "@/machines";

/**
 * Raffle Picker (bonus). Its own screen because its output is random:
 * Pick once or Pick 20 times, and Busted! asks what's wrong.
 */
export function RaffleStep({
  isNewKind,
  onBug,
  onDone,
}: {
  isNewKind: (kind: Category) => boolean;
  onBug: (kind: Category, text: string) => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("Sam\nJay\nMaria\nLeo");
  const [tries, setTries] = useState<RaffleTry[]>([]);
  const [bustOpen, setBustOpen] = useState(false);
  const last = tries.at(-1) ?? null;

  function pick(mode: "one" | "twenty") {
    const entries = entriesOf(text);
    const winners = Array.from({ length: mode === "one" ? 1 : 20 }, () => buggyPick(entries));
    const t: RaffleTry = { n: tries.length + 1, text, mode, winners };
    logEvent("input_submit", { n: t.n, inputs: { names: text }, mode, winners: winners.map((w) => (w === undefined ? null : w)) });
    setTries([...tries, t]);
  }

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[1fr_21rem] gap-5 px-5 py-4">
      <section className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-3xl border-4 border-ink bg-white p-5 shadow-[6px_6px_0_var(--ink)]">
        <div className="flex items-start gap-3">
          <span className="text-5xl leading-none" aria-hidden="true">
            {RAFFLE.icon}
          </span>
          <div>
            <h2 className="text-3xl font-bold">{RAFFLE.name}</h2>
            <p className="text-xl">{RAFFLE.purpose}</p>
          </div>
        </div>
        <p className="rounded-2xl bg-amber-soft px-4 py-2 text-lg">
          <span className="font-bold">📝 Request:</span> &ldquo;{RAFFLE.request}&rdquo;
        </p>
        <p className="self-start rounded-full border-2 border-teal/40 bg-teal/5 px-4 py-1 text-base font-bold text-teal">✅ Built and tested by AI.</p>
        <div className="grid min-h-0 flex-1 grid-cols-[14rem_1fr] gap-4">
          <label className="flex min-h-0 flex-col gap-1">
            <span className="text-lg font-bold text-ink-soft">Names (one per line)</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 400))}
              spellCheck={false}
              className="min-h-0 flex-1 resize-none rounded-2xl border-4 border-line bg-white p-3 text-xl outline-none focus:border-teal"
            />
          </label>
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex gap-2">
              <BigButton onClick={() => pick("one")} className="min-h-14! flex-1 px-4! text-lg!">
                Pick ▶
              </BigButton>
              <BigButton onClick={() => pick("twenty")} className="min-h-14! flex-1 px-4! text-lg!">
                Pick 20 times ▶
              </BigButton>
            </div>
            <Result t={last} />
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-3">
        <p className="text-lg font-bold text-ink-soft">⭐ Bonus app</p>
        <div className="flex-1" />
        <BigButton variant="danger" disabled={!last} onClick={() => setBustOpen(true)} className="min-h-20! text-2xl!">
          💥 Busted!
        </BigButton>
        <BigButton variant="secondary" onClick={onDone} className="min-h-14! text-lg!">
          I&apos;m done with the bonus →
        </BigButton>
      </aside>

      {bustOpen && last && (
        <RaffleBusted
          t={last}
          onDone={(claim, v) => {
            const counted = v.verdict === "real" && isNewKind(v.kind);
            logEvent("busted", { input_n: last.n, claim, verdict: v.verdict, bug_kind: v.verdict === "real" ? v.kind : null, counted });
            if (v.verdict === "real" && counted) onBug(v.kind, last.text);
          }}
          onClose={() => setBustOpen(false)}
        />
      )}
    </main>
  );
}

function Result({ t }: { t: RaffleTry | null }) {
  if (!t) return <p className="text-xl text-ink-soft">Tap Pick to choose a winner.</p>;
  if (t.mode === "one") {
    const w = t.winners[0];
    return (
      <p className="rounded-2xl border-4 border-dashed border-line bg-paper px-5 py-4 text-3xl font-bold whitespace-pre" aria-live="polite">
        🎉 Winner: {w === undefined ? "undefined" : w}
      </p>
    );
  }
  const rows = tally(entriesOf(t.text), t.winners);
  return (
    <div className="flex min-h-0 flex-col gap-1 overflow-y-auto rounded-2xl border-4 border-dashed border-line bg-paper p-3" aria-live="polite">
      <p className="text-lg font-bold">20 picks:</p>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2 text-lg">
          <span className="w-24 shrink-0 truncate font-bold whitespace-pre">{r.name.trim() === "" ? "(blank)" : r.name}</span>
          <span className="h-5 rounded bg-teal" style={{ width: `${r.wins * 5}%` }} />
          <span className="tabular-nums">{r.wins}</span>
        </div>
      ))}
      {t.winners.some((w) => w === undefined) && <p className="text-lg font-bold">undefined: {t.winners.filter((w) => w === undefined).length}</p>}
    </div>
  );
}

function RaffleBusted({ t, onDone, onClose }: { t: RaffleTry; onDone: (claim: RaffleClaim, v: RaffleVerdict) => void; onClose: () => void }) {
  const [result, setResult] = useState<RaffleVerdict | null>(null);
  if (result) {
    return (
      <Modal label="Busted result">
        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <span className="text-7xl" aria-hidden="true">
            {result.verdict === "real" ? "💥" : result.verdict === "debatable" ? "🤔" : "🔍"}
          </span>
          <p className="text-3xl leading-snug font-bold">{result.message}</p>
          <BigButton onClick={onClose}>Keep testing</BigButton>
        </div>
      </Modal>
    );
  }
  return (
    <Modal label="Busted">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">💥 What&apos;s wrong?</h2>
          <button type="button" onClick={onClose} className="min-h-12 rounded-full px-4 text-lg font-bold text-ink-soft hover:bg-paper">
            ✕ Cancel
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CLAIMS.map((c) => (
            <OptionButton
              key={c.id}
              onClick={() => {
                const v = judgeClaim(t, c.id);
                onDone(c.id, v);
                setResult(v);
              }}
            >
              {c.text}
            </OptionButton>
          ))}
        </div>
      </div>
    </Modal>
  );
}

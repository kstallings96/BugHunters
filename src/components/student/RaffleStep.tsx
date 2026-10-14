"use client";

import { useState } from "react";
import { BigButton, Modal } from "@/components/ui";
import { buggyPick, judgeTap, RAFFLE, tally, type RaffleTap, type RaffleTry, type RaffleVerdict } from "@/bonus/raffle";
import { clean, hasBadWords } from "@/lib/clean";
import { logEvent } from "@/lib/logger";
import type { Category } from "@/machines";

/**
 * Raffle Picker (bonus). Its own screen because its output is random:
 * Pick once or Pick 20 times. Busted! shows the last result again and asks
 * the student to tap the part that looks wrong, then (optionally) say why.
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
    const winners = Array.from({ length: mode === "one" ? 1 : 20 }, () => buggyPick(text));
    const t: RaffleTry = { n: tries.length + 1, text, mode, winners };
    logEvent("input_submit", { n: t.n, inputs: { names: text }, mode, winners });
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
            {last ? <Result t={last} /> : <p className="text-xl text-ink-soft">Tap Pick to choose a winner.</p>}
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
          onDone={(tap, explanation, v) => {
            const counted = v.verdict === "real" && isNewKind(v.kind);
            logEvent("busted", {
              input_n: last.n,
              tap,
              explanation,
              explanation_flagged: hasBadWords(explanation),
              verdict: v.verdict,
              bug_kind: v.verdict === "real" ? v.kind : null,
              counted,
            });
            if (v.verdict === "real" && counted) onBug(v.kind, last.text);
          }}
          onClose={() => setBustOpen(false)}
        />
      )}
    </main>
  );
}

/** The result of one try. With `onTap`, every part of it is a button. */
function Result({ t, onTap }: { t: RaffleTry; onTap?: (tap: RaffleTap) => void }) {
  if (t.mode === "one") {
    const body = <>🎉 Winner: {clean(t.winners[0])}</>;
    const look = "w-full rounded-2xl border-4 px-5 py-4 text-left text-3xl font-bold whitespace-pre";
    return onTap ? (
      <button type="button" onClick={() => onTap({ type: "winner" })} className={`${look} border-amber bg-white hover:bg-amber-soft`}>
        {body}
      </button>
    ) : (
      <p className={`${look} border-dashed border-line bg-paper`} aria-live="polite">
        {body}
      </p>
    );
  }
  const rows = tally(t.text, t.winners);
  return (
    <div className="flex min-h-0 flex-col gap-1 overflow-y-auto rounded-2xl border-4 border-dashed border-line bg-paper p-3" aria-live="polite">
      <p className="text-lg font-bold">20 picks:</p>
      {rows.map((r) => {
        const row = (
          <>
            <span className="w-24 shrink-0 truncate text-left font-bold">{clean(r.name)}</span>
            <span className="h-5 rounded bg-teal" style={{ width: `${r.wins * 5}%` }} />
            <span className="tabular-nums">{r.wins}</span>
          </>
        );
        return onTap ? (
          <button
            key={r.name}
            type="button"
            onClick={() => onTap({ type: "row", name: r.name })}
            className="flex min-h-12 items-center gap-2 rounded-xl border-4 border-amber bg-white px-2 text-lg hover:bg-amber-soft"
          >
            {row}
          </button>
        ) : (
          <div key={r.name} className="flex items-center gap-2 text-lg">
            {row}
          </div>
        );
      })}
      {rows.length === 0 && <p className="text-lg">{clean(t.winners[0] ?? "")}</p>}
    </div>
  );
}

function RaffleBusted({
  t,
  onDone,
  onClose,
}: {
  t: RaffleTry;
  onDone: (tap: RaffleTap, explanation: string, v: RaffleVerdict) => void;
  onClose: () => void;
}) {
  const [tap, setTap] = useState<RaffleTap | null>(null);
  const [why, setWhy] = useState("");
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

  function submit() {
    if (!tap) return;
    const v = judgeTap(t, tap);
    onDone(tap, why.trim(), v);
    setResult(v);
  }

  return (
    <Modal label="Busted">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">{tap ? "💥 What's wrong with it?" : "💥 Tap the part that looks wrong."}</h2>
          <button type="button" onClick={onClose} className="min-h-12 rounded-full px-4 text-lg font-bold text-ink-soft hover:bg-paper">
            ✕ Cancel
          </button>
        </div>
        {tap ? (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-xl">Say it in your own words. (You can skip this.)</span>
              <textarea
                value={why}
                onChange={(e) => setWhy(e.target.value.slice(0, 300))}
                rows={3}
                className="resize-none rounded-2xl border-4 border-line bg-white p-3 text-xl outline-none focus:border-teal"
              />
            </label>
            <BigButton onClick={submit} className="self-end">
              {why.trim() ? "Done →" : "Skip →"}
            </BigButton>
          </>
        ) : (
          <div className="flex max-h-80 flex-col">
            <Result t={t} onTap={setTap} />
          </div>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { GLITCH_APPS } from "@/apps";
import type { FormContent } from "@/content/types";
import { logEvent } from "@/lib/logger";
import type { Flag } from "@/lib/matching";
import { ReadAloud } from "../ReadAloud";
import { BigButton } from "../ui";
import { Modal, OptionButton, RequestChips } from "./parts";
import type { GameState } from "./state";

type Mode = "play" | "flag";
type Draft = Pick<Flag, "kind" | "feature" | "x" | "y">;

function describe(target: EventTarget | null): string {
  if (!(target instanceof HTMLElement)) return "";
  const text = target.innerText?.replace(/\s+/g, " ").trim().slice(0, 40) ?? "";
  return `${target.tagName.toLowerCase()}${text ? `:${text}` : ""}`;
}

/** Milliseconds since the hunt began. Called from event handlers only. */
function elapsed(start: number | null): number {
  const now = Date.now();
  return now - (start ?? now);
}

const round1 = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

export function HuntStep({
  form,
  game,
  huntCapSeconds,
  aiChecker,
  onUpdate,
  onDone,
}: {
  form: FormContent;
  game: GameState;
  huntCapSeconds: number;
  aiChecker: boolean;
  onUpdate: (patch: Partial<GameState>) => void;
  onDone: (capped: boolean) => void;
}) {
  const App = GLITCH_APPS[form.id]!;
  const [mode, setMode] = useState<Mode>("play");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [capped, setCapped] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const huntMs = () => elapsed(game.huntStartedAt);

  // Hidden time cap: the hunt ends gently; students never see a clock.
  useEffect(() => {
    const left = huntCapSeconds * 1000 - elapsed(game.huntStartedAt);
    const t = window.setTimeout(() => {
      setCapped(true);
      logEvent("hunt_capped", { hunt_ms: huntCapSeconds * 1000 });
    }, Math.max(0, left));
    return () => window.clearTimeout(t);
  }, [game.huntStartedAt, huntCapSeconds]);

  function switchMode(to: Mode) {
    if (to === mode) return;
    setMode(to);
    logEvent("mode_toggle", { to });
  }

  function onFrameClick(e: MouseEvent<HTMLDivElement>) {
    const rect = frame.current!.getBoundingClientRect();
    const keyboard = e.detail === 0;
    const x = keyboard ? null : round1(((e.clientX - rect.left) / rect.width) * 100);
    const y = keyboard ? null : round1(((e.clientY - rect.top) / rect.height) * 100);
    const feature = (e.target as HTMLElement).closest("[data-feature]")?.getAttribute("data-feature") ?? null;
    if (mode === "flag") {
      // Capture phase: the app never sees taps made in flag mode.
      e.stopPropagation();
      e.preventDefault();
      setDraft({ kind: "spot", feature, x, y });
      return;
    }
    logEvent("app_interaction", { feature, element: describe(e.target), x, y });
    if (feature && !game.featuresTouched.includes(feature)) {
      onUpdate({ featuresTouched: [...game.featuresTouched, feature] });
    }
  }

  function saveFlag(reason: Flag["reason"], requestItem: string | null, text: string) {
    if (!draft) return;
    const flag: Flag = { ...draft, id: game.nextFlagId, reason, requestItem, text: text.trim(), createdAt: new Date().toISOString() };
    logEvent("flag_create", {
      flag_id: flag.id,
      kind: flag.kind,
      feature: flag.feature,
      x: flag.x,
      y: flag.y,
      reason,
      request_item: requestItem,
      text: flag.text,
      mode,
      hunt_ms: huntMs(),
    });
    onUpdate({ flags: [...game.flags, flag], nextFlagId: game.nextFlagId + 1 });
    setDraft(null);
  }

  function deleteFlag(id: number) {
    logEvent("flag_delete", { flag_id: id, hunt_ms: huntMs() });
    onUpdate({ flags: game.flags.filter((f) => f.id !== id) });
  }

  function runCard(result: "pass" | "fail") {
    logEvent("card_run", { result, previous: game.cardResult, hunt_ms: huntMs() });
    onUpdate({ cardResult: result });
  }

  function askAi() {
    logEvent("ai_check_used", { n: game.aiChecks + 1, hunt_ms: huntMs(), flags_so_far: game.flags.length });
    onUpdate({ aiChecks: game.aiChecks + 1 });
    setAiOpen(true);
  }

  const featureLabel = (id: string | null) => form.features.find((f) => f.id === id)?.label ?? "Something";
  const reasonLabel: Record<Flag["reason"], string> = {
    mismatch: "Doesn't match",
    broken: "Broken",
    dislike: "Don't like it",
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-3">
      <RequestChips form={form} compact />

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_19rem] gap-4">
        {/* The app, inside a magnifying glass */}
        <div className="relative min-h-0 pr-6 pb-6">
          <div
            ref={frame}
            onClickCapture={onFrameClick}
            className={`relative h-full overflow-hidden rounded-[2.5rem] border-[10px] shadow-xl ${
              mode === "flag" ? "cursor-crosshair border-danger" : "border-ink"
            }`}
          >
            <App onAppEvent={(type, payload) => logEvent("app_event", { type, ...payload })} />
            {mode === "flag" && (
              <div className="pointer-events-none absolute inset-0 bg-danger/10">
                <p className="absolute top-6 left-1/2 -translate-x-1/2 rounded-full bg-danger px-5 py-1.5 text-lg font-bold whitespace-nowrap text-white shadow">
                  🚩 Tap a glitch to flag it
                </p>
              </div>
            )}
            {game.flags
              .filter((f) => f.x !== null && f.y !== null)
              .map((f) => (
                <span
                  key={f.id}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-full text-3xl drop-shadow"
                  style={{ left: `${f.x}%`, top: `${f.y}%` }}
                  aria-hidden="true"
                >
                  🚩
                </span>
              ))}
          </div>
          {/* magnifier handle */}
          <div className="pointer-events-none absolute right-0 bottom-0 h-16 w-6 origin-top rotate-[-45deg] rounded-full bg-ink" aria-hidden="true" />
        </div>

        {/* Tools */}
        <aside className="flex min-h-0 flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-line bg-card p-1" role="group" aria-label="Mode">
            {(["play", "flag"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                aria-pressed={mode === m}
                className={`flex min-h-14 items-center justify-center gap-2 rounded-xl text-lg font-bold transition ${
                  mode === m ? (m === "flag" ? "bg-danger text-white" : "bg-teal text-white") : "text-ink-soft hover:bg-paper"
                }`}
              >
                <span aria-hidden="true">{m === "play" ? "🎮" : "🚩"}</span> {m === "play" ? "Play" : "Flag"}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setDraft({ kind: "something", feature: null, x: null, y: null })}
            className="min-h-12 rounded-2xl border-2 border-danger/50 bg-card px-3 text-base font-bold text-danger hover:border-danger"
          >
            💥 Something happened
          </button>

          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border-2 border-line bg-card p-3">
            <p className="text-lg font-bold">🐞 Glitches found: {game.flags.length}</p>
            <ul className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-auto">
              {game.flags.map((f, i) => (
                <li key={f.id} className="flex items-center gap-2 rounded-lg bg-paper px-2 py-1 text-sm">
                  <span className="font-bold">🚩{i + 1}</span>
                  <span className="flex-1 truncate">
                    {f.kind === "something" ? "Something happened" : featureLabel(f.feature)} · {reasonLabel[f.reason]}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteFlag(f.id)}
                    aria-label={`Remove flag ${i + 1}`}
                    className="h-8 w-8 shrink-0 rounded-full text-ink-soft hover:bg-danger/10 hover:text-danger"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border-2 border-ink bg-white p-3">
            <div className="flex items-start gap-1">
              <p className="flex-1 text-sm leading-snug">
                <span className="font-bold">📝 When I</span> {game.card.when}, <span className="font-bold">it should</span> {game.card.should}.
              </p>
              <ReadAloud
                id="hunt.card"
                text={`My test card. When I ${game.card.when}, it should ${game.card.should}. Did it pass?`}
                className="h-10! w-10!"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["pass", "fail"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => runCard(r)}
                  aria-pressed={game.cardResult === r}
                  className={`min-h-11 rounded-xl border-2 text-base font-bold ${
                    game.cardResult === r
                      ? r === "pass"
                        ? "border-teal bg-teal text-white"
                        : "border-danger bg-danger text-white"
                      : "border-line hover:border-ink"
                  }`}
                >
                  {r === "pass" ? "✅ Pass" : "❌ Fail"}
                </button>
              ))}
            </div>
          </div>

          {aiChecker && (
            <button
              type="button"
              onClick={askAi}
              className="min-h-12 rounded-2xl border-2 border-[#475569] bg-[#f1f5f9] px-3 text-base font-bold text-[#334155] hover:border-ink"
            >
              🤖 Ask the AI: any glitches?
            </button>
          )}

          <BigButton onClick={() => onDone(false)} className="min-h-14! text-lg!">
            ✋ I&apos;m done hunting
          </BigButton>
        </aside>
      </div>

      {draft && (
        <FlagDialog
          form={form}
          draft={draft}
          where={draft.kind === "something" ? "Something happened" : featureLabel(draft.feature)}
          onCancel={(stage) => {
            logEvent("flag_cancel", { kind: draft.kind, feature: draft.feature, stage });
            setDraft(null);
          }}
          onSave={saveFlag}
        />
      )}

      {aiOpen && (
        <AiCheckerDialog
          form={form}
          onClose={() => {
            logEvent("ai_check_closed", { hunt_ms: huntMs() });
            setAiOpen(false);
          }}
        />
      )}

      {capped && (
        <Modal label="Time to stop">
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="text-6xl" aria-hidden="true">
              🎉
            </span>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold">Time to stop hunting. Great work!</p>
              <ReadAloud id="hunt.capped" text="Time to stop hunting. Great work!" />
            </div>
            <BigButton onClick={() => onDone(true)}>OK</BigButton>
          </div>
        </Modal>
      )}
    </main>
  );
}

// -------------------------------------------------------------- dialogs

function FlagDialog({
  form,
  draft,
  where,
  onCancel,
  onSave,
}: {
  form: FormContent;
  draft: Draft;
  where: string;
  onCancel: (stage: string) => void;
  onSave: (reason: Flag["reason"], requestItem: string | null, text: string) => void;
}) {
  const [reason, setReason] = useState<Flag["reason"] | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const [text, setText] = useState("");
  const stage = !reason ? "why" : reason === "mismatch" && !item ? "item" : "note";
  const name = form.client.name;

  const heading =
    stage === "why" ? "Why did you flag it?" : stage === "item" ? `What did ${name} ask for?` : "Want to say more? You can skip this.";

  return (
    <Modal label="Flag a glitch">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="rounded-full bg-danger/10 px-4 py-1 text-lg font-bold text-danger">
            🚩 {draft.kind === "something" ? where : `Flag: ${where}`}
          </p>
          <button
            type="button"
            onClick={() => onCancel(stage)}
            className="min-h-12 rounded-full px-4 text-lg font-bold text-ink-soft hover:bg-paper"
          >
            ✕ Cancel
          </button>
        </div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{heading}</h2>
          <ReadAloud
            id={`flag.${stage}`}
            text={
              stage === "why"
                ? `${heading} It doesn't match what ${name} asked. It's broken. I just don't like it.`
                : stage === "item"
                  ? `${heading} ${form.requestItems.map((i) => i.label).join(". ")}. Something else.`
                  : heading
            }
          />
        </div>

        {stage === "why" && (
          <div className="flex flex-col gap-3">
            <OptionButton icon="🙅" onClick={() => setReason("mismatch")}>
              It doesn&apos;t match what {name} asked
            </OptionButton>
            <OptionButton icon="💥" onClick={() => setReason("broken")}>
              It&apos;s broken
            </OptionButton>
            <OptionButton icon="😕" onClick={() => setReason("dislike")}>
              I just don&apos;t like it
            </OptionButton>
          </div>
        )}

        {stage === "item" && (
          <div className="grid grid-cols-2 gap-3">
            {form.requestItems.map((ri) => (
              <OptionButton key={ri.id} icon={ri.icon} onClick={() => setItem(ri.id)}>
                {ri.label}
              </OptionButton>
            ))}
            <OptionButton icon="❓" onClick={() => setItem("other")}>
              Something else
            </OptionButton>
          </div>
        )}

        {stage === "note" && (
          <div className="flex flex-col gap-4">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={200}
              autoFocus
              placeholder="What did you see?"
              aria-label="What did you see?"
              className="h-16 w-full rounded-2xl border-4 border-line bg-white px-4 text-xl outline-none focus:border-teal"
            />
            <BigButton onClick={() => onSave(reason!, reason === "mismatch" ? item : null, text)} className="self-end">
              🚩 Save flag
            </BigButton>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AiCheckerDialog({ form, onClose }: { form: FormContent; onClose: () => void }) {
  const [thinking, setThinking] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setThinking(false), 1800);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <Modal label="AI checker">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <span className="text-6xl leading-none" aria-hidden="true">
            🤖
          </span>
          <div className="flex-1 rounded-2xl bg-[#f1f5f9] p-5">
            {thinking ? (
              <p className="animate-pulse text-xl font-bold text-[#475569]">Checking the app…</p>
            ) : (
              <p className="text-xl leading-relaxed">{form.checker.answer}</p>
            )}
          </div>
        </div>
        {!thinking && (
          <div className="flex items-center justify-between">
            <ReadAloud id="ai.answer" text={form.checker.answer} />
            <BigButton onClick={onClose}>OK</BigButton>
          </div>
        )}
      </div>
    </Modal>
  );
}

"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { GLITCH_APPS } from "@/apps";
import type { FormContent } from "@/content/types";
import { logEvent } from "@/lib/logger";
import type { Flag } from "@/lib/matching";
import { ReadAloud } from "../ReadAloud";
import { BigButton } from "../ui";
import { Modal, OptionButton } from "./parts";
import type { GameState } from "./state";

/**
 * The hunt, kept deliberately simple: the app is always playable, and one
 * button starts a flag. Flagging is a short guided detour (tap the spot →
 * Why? → note) that drops the student straight back into playing.
 */

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
  // picking: waiting for the student to tap where the glitch is.
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [capped, setCapped] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const huntMs = () => elapsed(game.huntStartedAt);
  const name = form.client.name;

  // Hidden time cap: the hunt ends gently; students never see a clock.
  useEffect(() => {
    const left = huntCapSeconds * 1000 - elapsed(game.huntStartedAt);
    const t = window.setTimeout(() => {
      setCapped(true);
      logEvent("hunt_capped", { hunt_ms: huntCapSeconds * 1000 });
    }, Math.max(0, left));
    return () => window.clearTimeout(t);
  }, [game.huntStartedAt, huntCapSeconds]);

  function startFlag() {
    logEvent("flag_start", { hunt_ms: huntMs() });
    setPicking(true);
  }

  function notOneSpot() {
    setPicking(false);
    setDraft({ kind: "something", feature: null, x: null, y: null });
  }

  function cancelPick() {
    logEvent("flag_cancel", { stage: "pick" });
    setPicking(false);
  }

  function onFrameClick(e: MouseEvent<HTMLDivElement>) {
    const rect = frame.current!.getBoundingClientRect();
    const keyboard = e.detail === 0;
    const x = keyboard ? null : round1(((e.clientX - rect.left) / rect.width) * 100);
    const y = keyboard ? null : round1(((e.clientY - rect.top) / rect.height) * 100);
    const feature = (e.target as HTMLElement).closest("[data-feature]")?.getAttribute("data-feature") ?? null;
    if (picking) {
      // Capture phase: the app never sees the tap that places a flag.
      e.stopPropagation();
      e.preventDefault();
      setPicking(false);
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
      hunt_ms: huntMs(),
    });
    onUpdate({ flags: [...game.flags, flag], nextFlagId: game.nextFlagId + 1 });
    setDraft(null);
  }

  function deleteFlag(id: number) {
    logEvent("flag_delete", { flag_id: id, hunt_ms: huntMs() });
    onUpdate({ flags: game.flags.filter((f) => f.id !== id) });
  }

  function askAi() {
    logEvent("ai_check_used", { n: game.aiChecks + 1, hunt_ms: huntMs(), flags_so_far: game.flags.length });
    onUpdate({ aiChecks: game.aiChecks + 1 });
    setAiOpen(true);
  }

  const featureLabel = (id: string | null) => form.features.find((f) => f.id === id)?.label ?? "Something";
  const busy = picking || draft !== null;
  const spoken = `Play ${name}'s game. Does it match what ${name} asked for? ${form.requestItems.map((i) => i.label).join(". ")}. If you find a glitch, tap the flag button.`;

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[1fr_20rem] gap-5 px-5 py-3">
      {/* The app, inside a magnifying glass */}
      <div className="relative min-h-0 pr-6 pb-6">
        <div
          ref={frame}
          onClickCapture={onFrameClick}
          className={`relative h-full overflow-hidden rounded-[2.5rem] border-[10px] shadow-xl transition-colors ${
            picking ? "cursor-crosshair border-danger" : "border-ink"
          }`}
        >
          <App onAppEvent={(type, payload) => logEvent("app_event", { type, ...payload })} />
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
          {picking && (
            // Bottom, not top: the top of Maya's app is the countdown bar,
            // which is itself a glitch students may want to tap.
            <div className="pointer-events-none absolute inset-0 bg-danger/10">
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-danger px-6 py-2 text-xl font-bold whitespace-nowrap text-white shadow-lg">
                🚩 Tap the glitch
              </p>
            </div>
          )}
        </div>
        {/* magnifier handle */}
        <div className="pointer-events-none absolute right-0 bottom-0 h-16 w-6 origin-top rotate-[-45deg] rounded-full bg-ink" aria-hidden="true" />
      </div>

      <aside className="flex min-h-0 flex-col gap-2.5 overflow-y-auto">
        {picking ? (
          // While picking a spot, the sidebar holds only the two ways out.
          <div className="flex flex-col gap-3 rounded-3xl border-4 border-danger bg-card p-4">
            <p className="text-2xl font-bold text-danger">🚩 Tap the glitch in the app.</p>
            <button
              type="button"
              onClick={notOneSpot}
              className="min-h-14 rounded-2xl border-2 border-danger bg-white px-3 text-lg font-bold text-danger"
            >
              It&apos;s not in one spot
            </button>
            <button type="button" onClick={cancelPick} className="min-h-12 rounded-2xl px-3 text-lg font-bold text-ink-soft hover:bg-paper">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border-2 border-line bg-card px-4 py-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-lg font-bold">
                  {form.client.avatar} {name} asked for:
                </p>
                <ReadAloud id="hunt.checklist" text={spoken} className="h-11! w-11!" />
              </div>
              <ul className="flex flex-col gap-0.5">
                {form.requestItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-base leading-snug font-bold">
                    <span className="min-w-9 shrink-0 text-center text-xl whitespace-nowrap" aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={startFlag}
              disabled={busy}
              className="flex min-h-16 shrink-0 items-center justify-center gap-3 rounded-3xl border-b-4 border-[#8a1a12] bg-danger px-4 text-2xl font-bold text-white shadow-md active:translate-y-0.5 active:border-b-2"
            >
              🚩 I found a glitch!
            </button>

            <button
              type="button"
              onClick={() => setListOpen(true)}
              disabled={game.flags.length === 0}
              className="rounded-2xl px-3 py-1 text-xl font-bold enabled:hover:bg-card"
              aria-label={`Glitches found: ${game.flags.length}. Show my flags.`}
            >
              🐞 Glitches found: {game.flags.length}
            </button>

            <div className="flex-1" />

            {aiChecker && (
              <button
                type="button"
                onClick={askAi}
                className="min-h-12 rounded-2xl border-2 border-[#475569] bg-[#f1f5f9] px-3 text-base font-bold text-[#334155] hover:border-ink"
              >
                🤖 Ask the AI: any glitches?
              </button>
            )}

            <BigButton variant="secondary" onClick={() => onDone(false)} className="min-h-14! text-lg!">
              ✋ I&apos;m done hunting
            </BigButton>
          </>
        )}
      </aside>

      {draft && (
        <FlagDialog
          form={form}
          where={draft.kind === "something" ? "Not in one spot" : featureLabel(draft.feature)}
          onCancel={(stage) => {
            logEvent("flag_cancel", { kind: draft.kind, feature: draft.feature, stage });
            setDraft(null);
          }}
          onSave={saveFlag}
        />
      )}

      {listOpen && (
        <Modal label="My flags">
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold">🐞 My flags</h2>
            <ul className="flex flex-col gap-2">
              {game.flags.map((f, i) => (
                <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-paper px-4 py-2 text-lg">
                  <span className="font-bold">🚩 {i + 1}</span>
                  <span className="flex-1">
                    {f.kind === "something" ? "Not in one spot" : featureLabel(f.feature)}
                    {f.text && <span className="text-ink-soft"> · {f.text}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteFlag(f.id)}
                    className="min-h-11 rounded-full px-4 text-base font-bold text-danger hover:bg-danger/10"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <BigButton onClick={() => setListOpen(false)} className="self-end">
              Back to hunting
            </BigButton>
          </div>
        </Modal>
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
  where,
  onCancel,
  onSave,
}: {
  form: FormContent;
  where: string;
  onCancel: (stage: string) => void;
  onSave: (reason: Flag["reason"], requestItem: string | null, text: string) => void;
}) {
  const [reason, setReason] = useState<Flag["reason"] | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const [text, setText] = useState("");
  const stage = !reason ? "why" : reason === "mismatch" && !item ? "item" : "note";
  const name = form.client.name;

  const heading = stage === "why" ? "Why did you flag it?" : stage === "item" ? `What did ${name} ask for?` : "Want to say more?";
  const spoken =
    stage === "why"
      ? `${heading} It doesn't match what ${name} asked. It's broken. I just don't like it.`
      : stage === "item"
        ? `${heading} ${form.requestItems.map((i) => i.label).join(". ")}. Something else.`
        : `${heading} You can skip this.`;

  return (
    <Modal label="Flag a glitch">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="rounded-full bg-danger/10 px-4 py-1 text-lg font-bold text-danger">🚩 {where}</p>
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
          <ReadAloud id={`flag.${stage}`} text={spoken} />
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
              placeholder="What did you see? (You can skip this.)"
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

"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { GLITCH_APPS } from "@/apps";
import type { FormContent } from "@/content/types";
import { aiVerdictFor, judge, type Outcome, type TestCard, type Verdict } from "@/lib/cards";
import { logEvent } from "@/lib/logger";
import { ReadAloud } from "../ReadAloud";
import { ArrowIcon } from "../icons";
import { BigButton, Say } from "../ui";
import { Modal } from "./parts";
import { emptyDraft, MAX_CARDS, type CardDraft, type GameState } from "./state";

/**
 * Testing rounds, one thing on screen at a time:
 *   write    build a card: "When I ___, it should ___."
 *   test     try it in the client's app, then say pass or fail
 *   feedback did the card catch a glitch? write another, or stop
 */

function describe(target: EventTarget | null): string {
  if (!(target instanceof HTMLElement)) return "";
  const text = target.innerText?.replace(/\s+/g, " ").trim().slice(0, 40) ?? "";
  return `${target.tagName.toLowerCase()}${text ? `:${text}` : ""}`;
}

/** Milliseconds since `start`. Called from event handlers only. */
function elapsed(start: number | null): number {
  const now = Date.now();
  return now - (start ?? now);
}

const round1 = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

export const sentence = (c: { when: string; should: string }) => `When I ${c.when || "___"}, it should ${c.should || "___"}.`;

export function TestStep({
  form,
  game,
  capSeconds,
  aiChecker,
  onUpdate,
  onFinish,
}: {
  form: FormContent;
  game: GameState;
  capSeconds: number;
  aiChecker: boolean;
  onUpdate: (patch: Partial<GameState>) => void;
  onFinish: (capped: boolean) => void;
}) {
  const round = game.cards.length + 1;
  const [capped, setCapped] = useState(false);

  // Hidden time cap on all the rounds together; students never see a clock.
  useEffect(() => {
    const left = capSeconds * 1000 - elapsed(game.testStartedAt);
    const t = window.setTimeout(() => {
      setCapped(true);
      logEvent("test_capped", { test_ms: capSeconds * 1000, cards: game.cards.length });
    }, Math.max(0, left));
    return () => window.clearTimeout(t);
  }, [game.testStartedAt, capSeconds, game.cards.length]);

  const phase = (to: GameState["phase"], patch: Partial<GameState> = {}) => onUpdate({ ...patch, phase: to, phaseEnteredAt: Date.now() });

  let body: React.ReactNode;
  if (game.phase === "write") {
    body = (
      <WritePhase
        form={form}
        round={round}
        draft={game.draft}
        cards={game.cards}
        enteredAt={game.phaseEnteredAt}
        onDraft={(draft) => onUpdate({ draft })}
        onSubmit={() => phase("test")}
      />
    );
  } else if (game.phase === "test") {
    body = <TestPhase form={form} round={round} game={game} aiChecker={aiChecker} onUpdate={onUpdate} onVerdict={(card) => phase("feedback", { cards: [...game.cards, card], draft: emptyDraft })} />;
  } else {
    const last = game.cards.at(-1)!;
    body = (
      <FeedbackPhase
        form={form}
        card={last}
        canWriteMore={game.cards.length < MAX_CARDS}
        onAnother={() => {
          logEvent("round_start", { round: game.cards.length + 1 });
          phase("write");
        }}
        onDone={() => onFinish(false)}
      />
    );
  }

  return (
    <>
      {body}
      {capped && (
        <Modal label="Time to stop">
          <div className="flex flex-col items-center gap-5 text-center">
            <span className="text-6xl" aria-hidden="true">
              🎉
            </span>
            <Say id="test.capped" as="h2" text="Time to stop testing. Great work!" />
            <BigButton onClick={() => onFinish(true)}>OK</BigButton>
          </div>
        </Modal>
      )}
    </>
  );
}

// ------------------------------------------------------------- write

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-lg font-bold transition active:scale-95 ${
        selected ? "border-teal bg-teal text-white" : "border-teal/40 bg-white text-teal hover:border-teal"
      }`}
    >
      {children}
    </button>
  );
}

function WritePhase({
  form,
  round,
  draft,
  cards,
  enteredAt,
  onDraft,
  onSubmit,
}: {
  form: FormContent;
  round: number;
  draft: CardDraft;
  cards: TestCard[];
  enteredAt: number;
  onDraft: (d: CardDraft) => void;
  onSubmit: () => void;
}) {
  const edits = useRef(0);
  const [typing, setTyping] = useState<{ when: boolean; should: boolean }>({
    when: draft.whenSource === "typed",
    should: draft.should !== "" && draft.shouldItem === null,
  });
  const name = form.client.name;

  function edit(field: "when" | "should", value: string, source: "chip" | "typed", item: string | null = null) {
    edits.current += 1;
    if (source === "chip") logEvent("card_edit", { round, field, value, source, request_item: item });
    onDraft(
      field === "when"
        ? { ...draft, when: value, whenSource: source }
        : { ...draft, should: value, shouldItem: source === "chip" ? item : null },
    );
  }

  function typedBlur(field: "when" | "should") {
    const value = draft[field];
    if (value.trim()) logEvent("card_edit", { round, field, value, source: "typed" });
  }

  function submit() {
    logEvent("card_submit", {
      round,
      when: draft.when.trim(),
      when_source: draft.whenSource,
      should: draft.should.trim(),
      should_item: draft.shouldItem,
      edits: edits.current,
      ms: Date.now() - enteredAt,
    });
    onSubmit();
  }

  const ready = draft.when.trim() && draft.should.trim();
  const input = "h-12 w-full max-w-md rounded-2xl border-4 border-line bg-white px-4 text-xl outline-none focus:border-teal";
  const title = round === 1 ? `Make a test card for ${name}'s app.` : `Card ${round}: what will you test next?`;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 py-4">
      <Say
        id="write.screen"
        as="h1"
        text={title}
        speak={`${title} Finish the sentence. When I, blank, it should, blank. Tap a button for each part.`}
        className="text-3xl!"
      />

      <div className="flex flex-col gap-4 rounded-3xl border-4 border-ink bg-white px-6 py-4 shadow-[6px_6px_0_var(--ink)]">
        <p className="text-2xl font-bold" aria-live="polite">
          📝 {sentence(draft)}
        </p>

        <div className="flex flex-col gap-2">
          <p className="text-lg font-bold text-ink-soft">When I…</p>
          <div className="flex flex-wrap gap-2">
            {form.actions.map((a) => (
              <Chip key={a} selected={draft.whenSource === "chip" && draft.when === a} onClick={() => edit("when", a, "chip")}>
                {a}
              </Chip>
            ))}
            <Chip selected={typing.when} onClick={() => setTyping({ ...typing, when: true })}>
              ✏️ my own
            </Chip>
          </div>
          {typing.when && (
            <input
              className={input}
              autoFocus
              maxLength={80}
              value={draft.whenSource === "typed" ? draft.when : ""}
              onChange={(e) => edit("when", e.target.value, "typed")}
              onBlur={() => typedBlur("when")}
              placeholder="Type what you will do"
              aria-label="When I"
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-lg font-bold text-ink-soft">it should…</p>
          <div className="flex flex-wrap gap-2">
            {form.requestItems.map((ri) => (
              <Chip key={ri.id} selected={draft.shouldItem === ri.id} onClick={() => edit("should", ri.should, "chip", ri.id)}>
                <span aria-hidden="true" className="whitespace-nowrap">
                  {ri.icon}
                </span>
                {ri.should}
              </Chip>
            ))}
            <Chip selected={typing.should} onClick={() => setTyping({ ...typing, should: true })}>
              ✏️ my own
            </Chip>
          </div>
          {typing.should && (
            <input
              className={input}
              autoFocus
              maxLength={80}
              value={draft.shouldItem === null ? draft.should : ""}
              onChange={(e) => edit("should", e.target.value, "typed")}
              onBlur={() => typedBlur("should")}
              placeholder="Type what should happen"
              aria-label="it should"
            />
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <CardsSoFar form={form} cards={cards} />
        <BigButton onClick={submit} disabled={!ready}>
          Test it! <ArrowIcon />
        </BigButton>
      </div>
    </main>
  );
}

/** A small row of earlier cards: ✅/❌ and the request it tested. */
function CardsSoFar({ form, cards }: { form: FormContent; cards: TestCard[] }) {
  if (!cards.length) return <div className="flex-1" />;
  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <span className="text-base font-bold text-ink-soft">My cards:</span>
      {cards.map((c) => (
        <span
          key={c.round}
          title={sentence(c)}
          className="inline-flex items-center gap-1 rounded-full border-2 border-line bg-card px-3 py-0.5 text-base"
        >
          {c.verdict === "pass" ? "✅" : "❌"}
          <span aria-hidden="true">{form.requestItems.find((r) => r.id === c.shouldItem)?.icon ?? "✏️"}</span>
        </span>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- test

function TestPhase({
  form,
  round,
  game,
  aiChecker,
  onUpdate,
  onVerdict,
}: {
  form: FormContent;
  round: number;
  game: GameState;
  aiChecker: boolean;
  onUpdate: (patch: Partial<GameState>) => void;
  onVerdict: (card: TestCard) => void;
}) {
  const App = GLITCH_APPS[form.id]!;
  const frame = useRef<HTMLDivElement>(null);
  const interactions = useRef(0);
  const [ai, setAi] = useState<{ text: string } | null>(null);
  const draft = game.draft;
  const testMs = () => elapsed(game.phaseEnteredAt);

  function onFrameClick(e: MouseEvent<HTMLDivElement>) {
    const rect = frame.current!.getBoundingClientRect();
    const keyboard = e.detail === 0;
    const feature = (e.target as HTMLElement).closest("[data-feature]")?.getAttribute("data-feature") ?? null;
    interactions.current += 1;
    logEvent("app_interaction", {
      round,
      feature,
      element: describe(e.target),
      x: keyboard ? null : round1(((e.clientX - rect.left) / rect.width) * 100),
      y: keyboard ? null : round1(((e.clientY - rect.top) / rect.height) * 100),
    });
    if (feature && !game.featuresTouched.includes(feature)) onUpdate({ featuresTouched: [...game.featuresTouched, feature] });
  }

  function askAi() {
    const answer = aiVerdictFor(draft.shouldItem, form);
    logEvent("ai_check_used", { round, should_item: draft.shouldItem, ai_verdict: answer.verdict, test_ms: testMs(), n: game.aiChecks + 1 });
    onUpdate({ aiChecks: game.aiChecks + 1, draft: { ...draft, aiVerdict: answer.verdict } });
    setAi({ text: answer.text });
  }

  function verdict(v: Verdict) {
    logEvent("card_run", {
      round,
      verdict: v,
      should_item: draft.shouldItem,
      test_ms: testMs(),
      interactions: interactions.current,
      ai_verdict: draft.aiVerdict,
      agreed_with_ai: draft.aiVerdict ? draft.aiVerdict === v : null,
    });
    onVerdict({ round, when: draft.when.trim(), whenSource: draft.whenSource, should: draft.should.trim(), shouldItem: draft.shouldItem, verdict: v, aiVerdict: draft.aiVerdict });
  }

  return (
    <main className="grid min-h-0 flex-1 grid-cols-[1fr_20rem] gap-5 px-5 py-3">
      <div className="relative min-h-0 pr-6 pb-6">
        <div ref={frame} onClickCapture={onFrameClick} className="relative h-full overflow-hidden rounded-[2.5rem] border-[10px] border-ink shadow-xl">
          {/* key: every card is tested on a fresh copy of the app */}
          <App key={round} onAppEvent={(type, payload) => logEvent("app_event", { round, type, ...payload })} />
        </div>
        <div className="pointer-events-none absolute right-0 bottom-0 h-16 w-6 origin-top rotate-[-45deg] rounded-full bg-ink" aria-hidden="true" />
      </div>

      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <div className="rounded-3xl border-4 border-ink bg-white p-4 shadow-[4px_4px_0_var(--ink)]">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-base font-bold text-ink-soft">📝 Card {round}</p>
            <ReadAloud
              id="test.screen"
              text={`Your card says: ${sentence(draft)} Try it in ${form.client.name}'s app. Then tap pass or fail.`}
              className="h-11! w-11!"
            />
          </div>
          <p className="text-xl leading-snug font-bold">{sentence(draft)}</p>
        </div>

        <p className="px-1 text-lg">Try it in {form.client.name}&apos;s app. Then tap:</p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => verdict("pass")}
            className="flex min-h-16 items-center justify-center gap-3 rounded-3xl border-b-4 border-teal-dark bg-teal px-4 text-2xl font-bold text-white shadow-md active:translate-y-0.5 active:border-b-2"
          >
            ✅ It passed
          </button>
          <button
            type="button"
            onClick={() => verdict("fail")}
            className="flex min-h-16 items-center justify-center gap-3 rounded-3xl border-b-4 border-[#8a1a12] bg-danger px-4 text-2xl font-bold text-white shadow-md active:translate-y-0.5 active:border-b-2"
          >
            ❌ It failed
          </button>
        </div>

        <div className="flex-1" />

        {aiChecker && (
          <button
            type="button"
            onClick={askAi}
            className="min-h-12 rounded-2xl border-2 border-[#475569] bg-[#f1f5f9] px-3 text-base font-bold text-[#334155] hover:border-ink"
          >
            🤖 Ask the AI: did it pass?
          </button>
        )}
      </aside>

      {ai && (
        <AiDialog
          text={ai.text}
          onClose={() => {
            logEvent("ai_check_closed", { round, test_ms: testMs() });
            setAi(null);
          }}
        />
      )}
    </main>
  );
}

function AiDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const [thinking, setThinking] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setThinking(false), 1500);
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
            {thinking ? <p className="animate-pulse text-xl font-bold text-[#475569]">Checking the app…</p> : <p className="text-xl leading-relaxed">{text}</p>}
          </div>
        </div>
        {!thinking && (
          <div className="flex items-center justify-between">
            <ReadAloud id="ai.answer" text={text} />
            <BigButton onClick={onClose}>OK</BigButton>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------- feedback

function feedbackText(outcome: Outcome, form: FormContent, glitchId: string | null, shouldItem: string | null) {
  const glitch = form.glitches.find((g) => g.id === glitchId);
  const name = form.client.name;
  switch (outcome) {
    case "caught":
      return { icon: "🎉", title: "Your card caught a glitch!", line: `${glitch!.title}. Great testing!` };
    case "missed":
      return { icon: "🔍", title: "Look again!", line: `This card should fail. ${glitch!.howToFind}` };
    case "confirmed":
      return { icon: "✅", title: "Right! That part works.", line: `It matches what ${name} asked for.` };
    case "false_alarm": {
      const herring = form.redHerrings.find((h) => h.requestItem === shouldItem);
      return { icon: "🔍", title: "Look again!", line: herring?.why ?? `That part works the way ${name} asked.` };
    }
    default:
      return { icon: "📝", title: "Nice card!", line: "We will check this one later. Try another card, too." };
  }
}

function FeedbackPhase({
  form,
  card,
  canWriteMore,
  onAnother,
  onDone,
}: {
  form: FormContent;
  card: TestCard;
  canWriteMore: boolean;
  onAnother: () => void;
  onDone: () => void;
}) {
  const { outcome, truth, glitchId } = judge(card, form);
  const fb = feedbackText(outcome, form, glitchId, card.shouldItem);
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logEvent("card_feedback", { round: card.round, outcome, truth, glitch_id: glitchId });
  }, [card.round, outcome, truth, glitchId]);

  const good = outcome === "caught" || outcome === "confirmed";
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 px-6 py-6 text-center">
      <p className="rounded-2xl border-2 border-line bg-white px-5 py-3 text-lg">
        📝 {sentence(card)} <span className="font-bold">You said: {card.verdict === "pass" ? "✅ passed" : "❌ failed"}</span>
      </p>
      <span className="text-7xl" aria-hidden="true">
        {fb.icon}
      </span>
      <Say id="feedback.screen" as="h1" text={fb.title} speak={`${fb.title} ${fb.line}`} className={good ? "text-teal" : ""} />
      <p className="text-2xl leading-snug">{fb.line}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        {canWriteMore && (
          <BigButton onClick={onAnother}>
            📝 Write another card
          </BigButton>
        )}
        <BigButton variant="secondary" onClick={onDone}>
          ✋ I&apos;m done testing
        </BigButton>
      </div>
    </main>
  );
}

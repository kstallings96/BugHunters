"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { GLITCH_APPS } from "@/apps";
import type { FormContent, RequestItem } from "@/content/types";
import { aiVerdictFor, judge, starsFor, totalStars, type Outcome, type TestCard, type Verdict } from "@/lib/cards";
import { logEvent } from "@/lib/logger";
import { ReadAloud } from "../ReadAloud";
import { ArrowIcon } from "../icons";
import { BigButton, Say } from "../ui";
import { Modal } from "./parts";
import { emptyDraft, type CardDraft, type GameState } from "./state";

/**
 * One test card for each thing the client asked for, in order. Each round
 * shows one thing at a time:
 *   write    "When I ___, it should <this request>."
 *   test     try it in the client's app, then say passed or failed
 *   feedback the stars this card earned, then the next card
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
  const item = form.requestItems[Math.min(round, form.requestItems.length) - 1];
  const stars = totalStars(game.cards, form);
  const [capped, setCapped] = useState(false);

  // Hidden time cap on all the cards together; students never see a clock.
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
        item={item}
        round={round}
        stars={stars}
        draft={game.draft}
        cards={game.cards}
        enteredAt={game.phaseEnteredAt}
        onDraft={(draft) => onUpdate({ draft })}
        onSubmit={(draft) => phase("test", { draft })}
      />
    );
  } else if (game.phase === "test") {
    body = (
      <TestPhase
        form={form}
        round={round}
        stars={stars}
        game={game}
        aiChecker={aiChecker}
        onUpdate={onUpdate}
        onVerdict={(card) => phase("feedback", { cards: [...game.cards, card], draft: emptyDraft })}
      />
    );
  } else {
    const last = game.cards.at(-1)!;
    const more = game.cards.length < form.requestItems.length;
    body = (
      <FeedbackPhase
        form={form}
        card={last}
        earlier={game.cards.slice(0, -1)}
        total={stars}
        more={more}
        onNext={() => {
          if (more) {
            logEvent("round_start", { round: game.cards.length + 1, request_item: form.requestItems[game.cards.length].id });
            phase("write");
          } else {
            onFinish(false);
          }
        }}
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

function StarCount({ stars }: { stars: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-soft px-4 py-1 text-xl font-bold" aria-label={`${stars} stars`}>
      ⭐ {stars}
    </span>
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

/** The client's requests as a checklist: done (with the student's verdict), now, later. */
function Checklist({ form, cards, round }: { form: FormContent; cards: TestCard[]; round: number }) {
  return (
    <ol className="flex flex-col gap-1.5 rounded-3xl border-2 border-line bg-card p-4" aria-label={`${form.client.name}'s checklist`}>
      <li className="mb-1 text-lg font-bold">
        {form.client.avatar} {form.client.name} asked for:
      </li>
      {form.requestItems.map((ri, i) => {
        const card = cards[i];
        const now = i === round - 1;
        return (
          <li
            key={ri.id}
            aria-current={now ? "step" : undefined}
            className={`flex items-center gap-2 rounded-xl px-2 py-1 text-base font-bold ${now ? "bg-teal text-white" : card ? "" : "text-ink-soft"}`}
          >
            <span className="w-6 shrink-0 text-center" aria-hidden="true">
              {card ? (card.verdict === "pass" ? "✅" : "❌") : now ? "▶" : "⬜"}
            </span>
            <span className="min-w-8 shrink-0 text-center whitespace-nowrap" aria-hidden="true">
              {ri.icon}
            </span>
            {ri.label}
          </li>
        );
      })}
    </ol>
  );
}

function WritePhase({
  form,
  item,
  round,
  stars,
  draft,
  cards,
  enteredAt,
  onDraft,
  onSubmit,
}: {
  form: FormContent;
  item: RequestItem;
  round: number;
  stars: number;
  draft: CardDraft;
  cards: TestCard[];
  enteredAt: number;
  onDraft: (d: CardDraft) => void;
  onSubmit: (d: CardDraft) => void;
}) {
  const edits = useRef(0);
  const [typing, setTyping] = useState(draft.whenSource === "typed");
  const total = form.requestItems.length;
  const card = { ...draft, should: item.should, shouldItem: item.id };

  function edit(value: string, source: "chip" | "typed") {
    edits.current += 1;
    if (source === "chip") logEvent("card_edit", { round, field: "when", value, source, request_item: item.id });
    onDraft({ ...draft, when: value, whenSource: source });
  }

  function submit() {
    logEvent("card_submit", {
      round,
      request_item: item.id,
      when: card.when.trim(),
      when_source: card.whenSource,
      should: card.should,
      edits: edits.current,
      ms: elapsed(enteredAt),
    });
    onSubmit(card);
  }

  const title = `Card ${round} of ${total}: ${item.label}`;

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[17rem_1fr] gap-6 px-6 py-4">
      <Checklist form={form} cards={cards} round={round} />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Say
            id="write.screen"
            as="h1"
            text={title}
            speak={`${title}. How will you test it? Finish the card: When I, blank, it should ${item.should}. Tap a button or type your own.`}
            className="text-3xl!"
          />
          <StarCount stars={stars} />
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border-4 border-ink bg-white px-6 py-5 shadow-[6px_6px_0_var(--ink)]">
          <p className="text-2xl leading-snug font-bold" aria-live="polite">
            📝 {sentence(card)}
          </p>
          <div className="flex flex-col gap-2">
            <p className="text-lg font-bold text-ink-soft">How will you test it? When I…</p>
            <div className="flex flex-wrap gap-2">
              {form.actions.map((a) => (
                <Chip
                  key={a}
                  selected={draft.whenSource === "chip" && draft.when === a}
                  onClick={() => {
                    setTyping(false);
                    edit(a, "chip");
                  }}
                >
                  {a}
                </Chip>
              ))}
              <Chip selected={typing} onClick={() => setTyping(true)}>
                ✏️ my own idea
              </Chip>
            </div>
            {typing && (
              <input
                className="h-12 w-full max-w-lg rounded-2xl border-4 border-line bg-white px-4 text-xl outline-none focus:border-teal"
                autoFocus
                maxLength={80}
                value={draft.whenSource === "typed" ? draft.when : ""}
                onChange={(e) => edit(e.target.value, "typed")}
                onBlur={() => draft.whenSource === "typed" && draft.when.trim() && logEvent("card_edit", { round, field: "when", value: draft.when, source: "typed", request_item: item.id })}
                placeholder="Type what you will do"
                aria-label="When I"
              />
            )}
          </div>
        </div>

        <BigButton onClick={submit} disabled={!draft.when.trim()} className="self-end">
          Test it! <ArrowIcon />
        </BigButton>
      </div>
    </main>
  );
}

// -------------------------------------------------------------- test

function TestPhase({
  form,
  round,
  stars,
  game,
  aiChecker,
  onUpdate,
  onVerdict,
}: {
  form: FormContent;
  round: number;
  stars: number;
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
    onVerdict({
      round,
      when: draft.when.trim(),
      whenSource: draft.whenSource,
      should: draft.should,
      shouldItem: draft.shouldItem,
      verdict: v,
      aiVerdict: draft.aiVerdict,
      interactions: interactions.current,
    });
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
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold text-ink-soft">
            Card {round} of {form.requestItems.length}
          </p>
          <StarCount stars={stars} />
        </div>
        <div className="rounded-3xl border-4 border-ink bg-white p-4 shadow-[4px_4px_0_var(--ink)]">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-xl leading-snug font-bold">📝 {sentence(draft)}</p>
            <ReadAloud
              id="test.screen"
              text={`Your card says: ${sentence(draft)} Try it in ${form.client.name}'s app. Then tap passed or failed.`}
              className="h-11! w-11!"
            />
          </div>
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

function headline(outcome: Outcome, form: FormContent, glitchId: string | null, shouldItem: string | null) {
  const glitch = form.glitches.find((g) => g.id === glitchId);
  const name = form.client.name;
  switch (outcome) {
    case "caught":
      return { icon: "🎉", title: "Your card caught a glitch!", line: `${glitch!.title}.` };
    case "missed":
      return { icon: "🔍", title: "Look again!", line: `This card should fail. ${glitch!.howToFind}` };
    case "confirmed":
      return { icon: "✅", title: "Right! That part works.", line: `It matches what ${name} asked for.` };
    case "false_alarm": {
      const herring = form.redHerrings.find((h) => h.requestItem === shouldItem);
      return { icon: "🔍", title: "Look again!", line: herring?.why ?? `That part works the way ${name} asked.` };
    }
    default:
      return { icon: "📝", title: "Nice card!", line: "" };
  }
}

function FeedbackPhase({
  form,
  card,
  earlier,
  total,
  more,
  onNext,
}: {
  form: FormContent;
  card: TestCard;
  earlier: TestCard[];
  total: number;
  more: boolean;
  onNext: () => void;
}) {
  const { outcome, truth, glitchId } = judge(card, form);
  const stars = starsFor(card, earlier, form);
  const h = headline(outcome, form, glitchId, card.shouldItem);
  const logged = useRef(false);

  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    logEvent("card_feedback", {
      round: card.round,
      outcome,
      truth,
      glitch_id: glitchId,
      stars: { tried: stars.tried, right: stars.right, caught: stars.caught, own_idea: stars.ownIdea },
      stars_total: total,
    });
  }, [card.round, outcome, truth, glitchId, stars.tried, stars.right, stars.caught, stars.ownIdea, total]);

  // Only stars earned are listed; missing ones are never pointed out.
  const earned = [
    stars.caught && "You caught a glitch!",
    stars.right && "Right answer!",
    stars.tried && `You tried it in ${form.client.name}'s app.`,
    stars.ownIdea && "A new test idea!",
  ].filter(Boolean) as string[];
  const good = outcome === "caught" || outcome === "confirmed";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-6 py-5 text-center">
      <p className="rounded-2xl border-2 border-line bg-white px-5 py-2 text-lg">
        📝 {sentence(card)} <span className="font-bold">You said: {card.verdict === "pass" ? "✅ passed" : "❌ failed"}</span>
      </p>
      <span className="text-6xl" aria-hidden="true">
        {h.icon}
      </span>
      <Say
        id="feedback.screen"
        as="h1"
        text={h.title}
        speak={[h.title, h.line, ...earned.map((e) => `Star: ${e}`)].join(" ")}
        className={good ? "text-teal" : ""}
      />
      {h.line && <p className="text-2xl leading-snug">{h.line}</p>}
      {earned.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-2xl bg-amber-soft px-6 py-3 text-left text-xl font-bold">
          {earned.map((e) => (
            <li key={e}>+⭐ {e}</li>
          ))}
        </ul>
      )}
      <div className="mt-1 flex items-center gap-4">
        <StarCount stars={total} />
        <BigButton onClick={onNext}>
          {more ? "Next card" : "All done!"} <ArrowIcon />
        </BigButton>
      </div>
    </main>
  );
}

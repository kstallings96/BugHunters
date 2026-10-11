"use client";

import { useEffect, useRef, useState } from "react";
import { getForm } from "@/content";
import { summarizeCards } from "@/lib/cards";
import { endSession, flushNow, logEvent, setStep } from "@/lib/logger";
import type { ClientSession, Step } from "@/lib/types";
import { DoneStep, EndStep, FixStep, RevealStep, SurveyStep } from "./EndSteps";
import { MeetStep } from "./IntroSteps";
import { GameHeader } from "./parts";
import { clearGame, loadGame, newGame, nextStep, saveGame, type GameState } from "./state";
import { TestStep } from "./TestStep";

/**
 * Runs one session through the steps. Every step change logs step_exit (with
 * time spent) and step_enter; progress is saved so a reload lands on the
 * same step.
 */
export function Game({ session, onFinish }: { session: ClientSession; onFinish: () => void }) {
  const form = getForm(session.form);
  const [game, setGame] = useState<GameState>(() => loadGame(session.id) ?? newGame(session.surveyEnabled));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setStep(game.step);
    // A brand-new game has no saved state yet; a resumed one already logged its step.
    if (!loadGame(session.id)) logEvent("step_enter", { first: true }, game.step);
  }, [game.step, session.id]);

  useEffect(() => {
    saveGame(session.id, game);
  }, [session.id, game]);

  function update(patch: Partial<GameState>) {
    setGame((g) => ({ ...g, ...patch }));
  }

  function go(patch: Partial<GameState> = {}, to?: Step) {
    const next = to ?? nextStep(game.step, session.surveyEnabled);
    const now = Date.now();
    logEvent("step_exit", { ms: now - game.stepEnteredAt }, game.step);
    setStep(next);
    logEvent("step_enter", {}, next);
    if (next === "test") logEvent("round_start", { round: 1 }, next);
    setGame((g) => ({
      ...g,
      ...patch,
      step: next,
      stepEnteredAt: now,
      ...(next === "test" ? { testStartedAt: now, phase: "write" as const, phaseEnteredAt: now } : {}),
    }));
    void flushNow();
  }

  function finish() {
    logEvent("step_exit", { ms: Date.now() - game.stepEnteredAt }, game.step);
    endSession({ cards: game.cards.length });
    clearGame(session.id);
    onFinish();
  }

  let body: React.ReactNode;
  switch (game.step) {
    case "survey_pre":
    case "survey_post":
      body = <SurveyStep key={game.step} when={game.step === "survey_pre" ? "pre" : "post"} onAnswer={() => go()} />;
      break;
    case "meet":
      body = <MeetStep form={form} onNext={() => go()} />;
      break;
    case "test":
      body = (
        <TestStep
          form={form}
          game={game}
          capSeconds={session.huntCapSeconds}
          aiChecker={session.condition === "ai_checker"}
          onUpdate={update}
          onFinish={(capped) => go({ capped, testEndedAt: Date.now() })}
        />
      );
      break;
    case "done":
      body = (
        <DoneStep
          onConfidence={(confidence) => {
            const end = game.testEndedAt ?? Date.now();
            const summary = summarizeCards(game.cards, form);
            logEvent("done", {
              confidence,
              capped: game.capped,
              test_ms: end - (game.testStartedAt ?? end),
              stopped_at: new Date(end).toISOString(),
              cards: game.cards.length,
              found: summary.found,
              ai_checks: game.aiChecks,
            });
            go({ confidence });
          }}
        />
      );
      break;
    case "reveal":
      body = <RevealStep form={form} game={game} onNext={() => go()} />;
      break;
    case "fix":
      body = <FixStep form={form} enteredAt={game.stepEnteredAt} onSubmit={(glitchId, text) => go({ fix: { glitchId, text } })} />;
      break;
    default:
      body = <EndStep form={form} onFinish={finish} />;
  }

  return (
    <div className={`flex flex-1 flex-col ${game.step === "test" ? "h-dvh" : "min-h-dvh"}`}>
      <GameHeader step={game.step} />
      {body}
    </div>
  );
}

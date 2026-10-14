"use client";

import { useEffect, useRef, useState } from "react";
import { INTAKE } from "@/config/survey";
import { endSession, flushNow, logEvent, setStep } from "@/lib/logger";
import type { ClientSession } from "@/lib/types";
import { MACHINES, type Category, type MachineId } from "@/machines";
import { nicknameFor } from "@/lib/nickname";
import { Briefing, Intro, Ready } from "./Intro";
import { Leaderboard } from "./Leaderboard";
import { RaffleStep } from "./RaffleStep";
import { FullReveal, MachineReveal, NextApp } from "./Reveal";
import { MachineStep, type BustedResult } from "./MachineStep";

/** Tries per measured machine. Scarcity makes probes deliberate (as in AlwaysNever). */
const MAX_TRIES = 8;
import { EndScreen, GuiltyLine, SurveyScreen } from "./Screens";
import {
  categoryCounts,
  clearGame,
  codeQuestions,
  gameFromProgress,
  isEdge,
  isNewBug,
  loadGame,
  measuredBugs,
  newGame,
  progressStage,
  saveGame,
  STEP_OF,
  type GameState,
  type Screen,
  type Try,
} from "./state";

/**
 * One student's session: two intake questions → intro and guided demo →
 * three apps (each followed by a reveal or "Next app") → end (→ bonus). Every screen change logs
 * step_exit and step_enter; progress is kept in sessionStorage so a reload
 * lands on the same screen.
 */
export function Game({ session, onFinish }: { session: ClientSession; onFinish: () => void }) {
  const [game, setGame] = useState<GameState>(
    () => loadGame(session.id) ?? (session.progress ? gameFromProgress(session.progress) : newGame()),
  );
  const started = useRef(false);
  const machineFor = (g: GameState): MachineId | "raffle" | null =>
    g.screen === "tutorial"
      ? "allowance"
      : g.screen === "briefing" || g.screen === "machine" || g.screen === "between"
        ? session.machineOrder[g.machineIndex]
        : g.screen === "bonus_machine"
          ? "raffle"
          : null;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setStep(STEP_OF[game.screen], machineFor(game));
    // New or server-resumed games announce where they are; a plain reload doesn't need to.
    if (!loadGame(session.id)) logEvent("step_enter", { screen: game.screen, machine_index: game.machineIndex, resumed: !!session.progress });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveGame(session.id, game);
  }, [session.id, game]);

  function go(screen: Screen, patch: Partial<GameState> = {}) {
    const now = Date.now();
    logEvent("step_exit", { screen: game.screen, ms: now - game.screenEnteredAt });
    const next: GameState = { ...game, ...patch, screen, screenEnteredAt: now };
    if (screen === "machine" && (game.screen !== "machine" || patch.machineIndex !== undefined)) next.machineStartedAt = now;
    if (screen === "bonus_machine") next.machineStartedAt = now;
    setStep(STEP_OF[screen], machineFor(next));
    logEvent("step_enter", { screen, machine_index: next.machineIndex });
    if (screen === "bonus_machine") logEvent("bonus_enter", { busted: next.busted.length });
    setGame(next);
    void flushNow();
  }

  function addTry(machine: MachineId, t: Try) {
    setGame((g) => ({ ...g, tries: { ...g.tries, [machine]: [...(g.tries[machine] ?? []), t] } }));
  }

  function busted(machine: MachineId, r: BustedResult, counts: boolean) {
    if (!counts || !r.counted || !r.kind) return;
    setGame((g) => ({ ...g, busted: [...g.busted, { machine, kind: r.kind!, inputs: r.inputs }] }));
  }

  function accept(machine: MachineId, via: "button" | "nudge", then: () => void) {
    const tries = game.tries[machine] ?? [];
    logEvent("accept_machine", {
      via,
      inputs_total: tries.length,
      edge_inputs: tries.filter(isEdge).length,
      category_counts: categoryCounts(tries),
      ms_on_machine: Date.now() - game.machineStartedAt,
    });
    then();
  }

  function finish() {
    logEvent("step_exit", { screen: game.screen, ms: Date.now() - game.screenEnteredAt });
    endSession({ busted: game.busted.length });
    clearGame(session.id);
    onFinish();
  }

  const isNewKind = (machine: MachineId) => (kind: Category) => isNewBug(game.busted, machine, kind);
  // Sessions saved before the reveal condition existed get the full reveal at the end.
  const revealCondition = session.revealCondition ?? "end_only";
  const counter = game.screen === "machine" || game.screen === "bonus_machine";
  const board = <Leaderboard token={session.token} bugs={measuredBugs(game.busted)} />;

  let body: React.ReactNode;
  switch (game.screen) {
    case "intake_coding":
      body = <SurveyScreen key="coding" q={INTAKE[0]} onAnswer={() => go("intake_ai")} />;
      break;
    case "intake_ai":
      body = <SurveyScreen key="ai" q={INTAKE[1]} onAnswer={() => go("intro")} />;
      break;
    case "intro":
      body = <Intro onDone={() => go("tutorial")} />;
      break;
    case "tutorial":
      body = <Tutorial game={game} onTry={(t) => addTry("allowance", t)} onDone={() => go("ready")} />;
      break;
    case "ready":
      body = <Ready count={session.machineOrder.length} nickname={nicknameFor(session.id)} onStart={() => go("briefing", { machineIndex: 0 })} />;
      break;
    case "briefing": {
      const id = session.machineOrder[game.machineIndex];
      body = <Briefing key={id} machine={MACHINES[id]} index={game.machineIndex} total={session.machineOrder.length} onStart={() => go("machine")} />;
      break;
    }
    case "machine": {
      const id = session.machineOrder[game.machineIndex];
      const lastMachine = game.machineIndex >= session.machineOrder.length - 1;
      // Every app is followed by the in-between screen: a reveal or just "Next app".
      const advance = () => go("between");
      body = (
        <MachineStep
          key={id}
          machine={MACHINES[id]}
          title={`Machine ${game.machineIndex + 1} of ${session.machineOrder.length}`}
          tries={game.tries[id] ?? []}
          onTry={(t) => addTry(id, t)}
          isNewKind={isNewKind(id)}
          onBusted={(r) => busted(id, r, true)}
          acceptLabel={lastMachine ? "Looks good, I'm done →" : "Looks good, next machine →"}
          maxTries={MAX_TRIES}
          onAccept={(via) => accept(id, via, advance)}
          nudgeAt={game.machineStartedAt + session.nudgeSeconds * 1000}
          onNudge={() => {
            if (game.nudged[id]) return;
            logEvent("nudge_shown", { after_s: session.nudgeSeconds });
            setGame((g) => ({ ...g, nudged: { ...g.nudged, [id]: true } }));
          }}
        />
      );
      break;
    }
    case "between": {
      const id = session.machineOrder[game.machineIndex];
      const lastMachine = game.machineIndex >= session.machineOrder.length - 1;
      const next = () => (lastMachine ? go("end") : go("briefing", { machineIndex: game.machineIndex + 1 }));
      body =
        revealCondition === "reveal" ? (
          <MachineReveal key={id} machine={id} busted={game.busted} last={lastMachine} onNext={next} />
        ) : lastMachine ? (
          <FullReveal machines={session.machineOrder} busted={game.busted} onNext={next} />
        ) : (
          <NextApp key={id} onNext={next} />
        );
      break;
    }
    case "bonus_machine":
      body = (
        <RaffleStep
          isNewKind={(kind) => isNewBug(game.busted, "raffle", kind)}
          onBug={(kind, text) => setGame((g) => ({ ...g, busted: [...g.busted, { machine: "raffle", kind, inputs: { names: text } }] }))}
          onDone={() => (game.busted.length ? go("bonus_guilty", { guiltyIndex: 0 }) : go("end", { bonusDone: true }))}
        />
      );
      break;
    case "bonus_guilty": {
      // A few code questions at most, and the student can leave any time.
      const questions = codeQuestions(game.busted);
      const bug = questions[game.guiltyIndex];
      const last = game.guiltyIndex >= questions.length - 1;
      body = bug ? (
        <GuiltyLine
          key={game.guiltyIndex}
          bug={bug}
          index={game.guiltyIndex}
          total={questions.length}
          onNext={() => (last ? go("end", { bonusDone: true }) : setGame((g) => ({ ...g, guiltyIndex: g.guiltyIndex + 1 })))}
          onSkip={() => go("end", { bonusDone: true })}
        />
      ) : (
        <EndScreen busted={game.busted} bonusDone onBonus={() => {}} onFinish={finish} leaderboard={board} />
      );
      break;
    }
    default:
      body = <EndScreen busted={game.busted} bonusDone={game.bonusDone} onBonus={() => go("bonus_machine")} onFinish={finish} leaderboard={board} />;
  }

  return (
    <div className={`flex flex-1 flex-col ${counter || game.screen === "tutorial" || game.screen === "between" ? "h-dvh" : "min-h-dvh"}`}>
      <header className="flex h-14 shrink-0 items-center gap-5 border-b-2 border-line bg-card px-5">
        <span className="shrink-0 text-xl font-bold">
          🔍 bug<span className="text-teal">Hunters</span>
        </span>
        <ProgressBar stage={progressStage(game.screen, game.machineIndex)} />
        {counter && <span className="shrink-0 rounded-full bg-amber-soft px-4 py-1 text-xl font-bold">💥 {game.busted.length} busted</span>}
        <span className="shrink-0 text-base text-ink-soft">
          {session.firstName} {session.lastInitial}.
        </span>
      </header>
      {body}
    </div>
  );
}

// ----------------------------------------------------------- tutorial

/**
 * Intro screen 3: a guided demo on the Allowance Doubler. Type 10 (it
 * works), type a word ($???), tap Busted! once. Each stage is worked out
 * from what the student has done so far.
 */
function Tutorial({ game, onTry, onDone }: { game: GameState; onTry: (t: Try) => void; onDone: () => void }) {
  const tries = game.tries.allowance ?? [];
  const stage = tries.some((t) => t.revealsBug) ? 3 : tries.some((t) => !t.revealsBug) ? 2 : 1;
  const logged = useRef(0);

  useEffect(() => {
    if (logged.current === stage) return;
    logged.current = stage;
    logEvent("tutorial_step", { stage });
  }, [stage]);

  const coach: Record<number, string> = {
    1: "Type 10, then tap Try it.",
    2: "That one works. ✅ Now try to break it. Type a word.",
    3: "That's a bug! The AI didn't plan for words. Tap Busted!",
  };

  return (
    <MachineStep
      machine={MACHINES.allowance}
      title="Practice"
      tries={tries}
      onTry={onTry}
      isNewKind={() => true}
      onBusted={(r) => r.verdict === "real" && onDone()}
      highlightField={stage <= 2 ? "allowance" : undefined}
      pulseBusted={stage === 3}
      coach={
        <div className="flex items-center gap-4 rounded-2xl border-4 border-teal bg-teal/5 px-5 py-3">
          <span className="text-4xl" aria-hidden="true">
            👉
          </span>
          <p className="flex-1 text-2xl font-bold">{coach[stage]}</p>
        </div>
      }
    />
  );
}

// ------------------------------------------------------------ progress

const PARTS = ["Questions", "Practice", "App 1", "App 2", "App 3", "Done"];

/** How far through the session the student is: finished parts filled, the current one outlined. */
function ProgressBar({ stage }: { stage: number }) {
  return (
    <ol className="flex flex-1 items-center gap-1.5" aria-label={`Progress: ${PARTS[stage]}`}>
      {PARTS.map((label, i) => (
        <li
          key={label}
          aria-current={i === stage ? "step" : undefined}
          className={`flex h-8 flex-1 items-center justify-center rounded-full text-sm font-bold ${
            i < stage || stage === PARTS.length - 1
              ? "bg-teal text-white"
              : i === stage
                ? "border-4 border-teal bg-teal/10 text-teal"
                : "bg-paper text-ink-soft"
          }`}
        >
          {i < stage || (stage === PARTS.length - 1 && i === stage) ? `✓ ${label}` : label}
        </li>
      ))}
    </ol>
  );
}

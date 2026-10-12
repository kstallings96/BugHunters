"use client";

import { useEffect, useRef, useState } from "react";
import { BigButton } from "@/components/ui";
import { CODING_QUESTION } from "@/config/survey";
import { endSession, flushNow, logEvent, setStep } from "@/lib/logger";
import type { ClientSession } from "@/lib/types";
import { MACHINES, type Category, type MachineId } from "@/machines";
import { MachineStep, type BustedResult } from "./MachineStep";
import { EndScreen, GuiltyLine, SurveyScreen } from "./Screens";
import {
  categoryCounts,
  clearGame,
  gameFromProgress,
  isEdge,
  isNewBug,
  loadGame,
  newGame,
  saveGame,
  STEP_OF,
  type GameState,
  type Screen,
  type Try,
} from "./state";

/**
 * One student's session: coding-experience question → tutorial → three
 * machines → end (→ optional bonus). Every screen change logs
 * step_exit and step_enter; progress is kept in sessionStorage so a reload
 * lands on the same screen.
 */
export function Game({ session, onFinish }: { session: ClientSession; onFinish: () => void }) {
  const [game, setGame] = useState<GameState>(
    () => loadGame(session.id) ?? (session.progress ? gameFromProgress(session.progress) : newGame()),
  );
  const started = useRef(false);
  const machineFor = (g: GameState): MachineId | null =>
    g.screen === "tutorial" ? "double" : g.screen === "machine" ? session.machineOrder[g.machineIndex] : g.screen === "bonus_machine" ? "birthday" : null;

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
  const counter = game.screen === "machine" || game.screen === "bonus_machine";

  let body: React.ReactNode;
  switch (game.screen) {
    case "pre_coding":
      body = <SurveyScreen q={CODING_QUESTION} onAnswer={() => go("tutorial")} />;
      break;
    case "tutorial":
      body = <Tutorial game={game} onTry={(t) => addTry("double", t)} onStart={() => go("machine", { machineIndex: 0 })} />;
      break;
    case "machine": {
      const id = session.machineOrder[game.machineIndex];
      const lastMachine = game.machineIndex >= session.machineOrder.length - 1;
      const advance = () => (lastMachine ? go("end") : go("machine", { machineIndex: game.machineIndex + 1 }));
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
    case "bonus_machine":
      body = (
        <MachineStep
          key="birthday"
          machine={MACHINES.birthday}
          title="⭐ Bonus machine"
          tries={game.tries.birthday ?? []}
          onTry={(t) => addTry("birthday", t)}
          isNewKind={isNewKind("birthday")}
          onBusted={(r) => busted("birthday", r, true)}
          acceptLabel="I'm done with the bonus →"
          onAccept={(via) => accept("birthday", via, () => (game.busted.length ? go("bonus_guilty", { guiltyIndex: 0 }) : go("end", { bonusDone: true })))}
        />
      );
      break;
    case "bonus_guilty": {
      const bug = game.busted[game.guiltyIndex];
      const last = game.guiltyIndex >= game.busted.length - 1;
      body = bug ? (
        <GuiltyLine
          key={game.guiltyIndex}
          bug={bug}
          last={last}
          onNext={() => (last ? go("end", { bonusDone: true }) : setGame((g) => ({ ...g, guiltyIndex: g.guiltyIndex + 1 })))}
        />
      ) : (
        <EndScreen busted={game.busted} bonusDone onBonus={() => {}} onFinish={finish} />
      );
      break;
    }
    default:
      body = <EndScreen busted={game.busted} bonusDone={game.bonusDone} onBonus={() => go("bonus_machine")} onFinish={finish} />;
  }

  return (
    <div className={`flex flex-1 flex-col ${counter || game.screen === "tutorial" ? "h-dvh" : "min-h-dvh"}`}>
      <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-line bg-card px-5">
        <span className="text-xl font-bold">
          🔍 bug<span className="text-teal">Hunters</span>
        </span>
        {counter && <span className="rounded-full bg-amber-soft px-4 py-1 text-xl font-bold">💥 Bugs busted: {game.busted.length}</span>}
        <span className="text-base text-ink-soft">
          {session.firstName} {session.lastInitial}.
        </span>
      </header>
      {body}
    </div>
  );
}

// ----------------------------------------------------------- tutorial

/**
 * Double It, guided: try 4 (it works), try "cat" (NaN), tap Busted!, then
 * start. Each stage is worked out from what the student has done so far.
 */
function Tutorial({ game, onTry, onStart }: { game: GameState; onTry: (t: Try) => void; onStart: () => void }) {
  const tries = game.tries.double ?? [];
  const [bustedReal, setBustedReal] = useState(false);
  const stage = bustedReal ? 4 : tries.some((t) => t.revealsBug) ? 3 : tries.some((t) => !t.revealsBug) ? 2 : 1;
  const logged = useRef(0);

  useEffect(() => {
    if (logged.current === stage) return;
    logged.current = stage;
    logEvent("tutorial_step", { stage });
  }, [stage]);

  const coach: Record<number, string> = {
    1: "Let's practice! Type 4, then tap Try it.",
    2: "It works! Now type cat and tap Try it.",
    3: "That's not right! Tap Busted!",
    4: "Your job: find inputs that break the AI's tools.",
  };

  return (
    <MachineStep
      machine={MACHINES.double}
      title="Practice"
      tries={tries}
      onTry={onTry}
      isNewKind={() => true}
      onBusted={(r) => r.verdict === "real" && setBustedReal(true)}
      highlightField={stage <= 2 ? "number" : undefined}
      pulseBusted={stage === 3}
      locked={stage === 4}
      coach={
        <div className="flex items-center gap-4 rounded-2xl border-4 border-teal bg-teal/5 px-5 py-3">
          <span className="text-4xl" aria-hidden="true">
            {stage === 4 ? "🔨" : "👉"}
          </span>
          <p className="flex-1 text-2xl font-bold">{coach[stage]}</p>
          {stage === 4 && <BigButton onClick={onStart}>Let&apos;s go! →</BigButton>}
        </div>
      }
    />
  );
}

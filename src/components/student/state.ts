import type { BustedBug, Progress, Step } from "@/lib/types";
import { RAFFLE } from "@/bonus/raffle";
import { MACHINES } from "@/machines";
import type { Category, Inputs, MachineId, Output } from "@/machines/types";

/** Screens in order. Each maps to a logged `step`. */
export type Screen =
  | "intake_coding"
  | "intake_ai"
  | "intro"
  | "tutorial"
  | "ready"
  | "briefing"
  | "machine"
  | "between"
  | "end"
  /** Code questions, after the three apps: required, and part of the score. */
  | "code";

export const STEP_OF: Record<Screen, Step> = {
  intake_coding: "intake",
  intake_ai: "intake",
  intro: "intro",
  tutorial: "tutorial",
  ready: "intro",
  briefing: "briefing",
  machine: "machine",
  between: "reveal",
  end: "end",
  code: "code",
};

/** One "Try it" on a machine. */
export interface Try {
  n: number;
  inputs: Inputs;
  output: Output;
  /** What the machine should have said (reference version). */
  correct: string;
  categories: Category[];
  revealsBug: boolean;
  bugKind: Category | null;
  /** Every bug this input shows (absent on tries saved before it existed). */
  bugKinds?: Category[];
  debatable: boolean;
}

export interface GameState {
  screen: Screen;
  screenEnteredAt: number;
  /** 0–2 into the session's machine order. */
  machineIndex: number;
  machineStartedAt: number;
  tries: Partial<Record<MachineId, Try[]>>;
  /** Real bugs busted, one per kind per machine (the counter). */
  busted: BustedBug[];
  nudged: Partial<Record<MachineId, boolean>>;
  /** Points per code question (1 per part right), by question number. */
  codeScores: number[];
  guiltyIndex: number;
}

export function newGame(now = Date.now()): GameState {
  return {
    screen: "intake_coding",
    screenEnteredAt: now,
    machineIndex: 0,
    machineStartedAt: now,
    tries: {},
    busted: [],
    nudged: {},
    codeScores: [],
    guiltyIndex: 0,
  };
}

/** Rebuilds a game from the server's record when a student chose "Keep going". */
export function gameFromProgress(p: Progress, now = Date.now()): GameState {
  const screen: Screen =
    p.step === "tutorial" || p.step === "intro"
      ? "intro"
      : p.step === "briefing" || p.step === "machine" || p.step === "reveal"
        ? "briefing"
        : p.step === "code"
          ? "code"
          : p.step === "post_survey" || p.step === "end" || p.step === "bonus_machine" || p.step === "bonus_guilty"
            ? "end"
            : "intake_coding";
  return { ...newGame(now), screen, machineIndex: Math.min(2, Math.max(0, p.machineIndex)), busted: p.busted };
}

/** Does this real bug add to the counter? Not if the same kind was already busted on this machine. */
export function isNewBug(busted: BustedBug[], machine: MachineId | "raffle", kind: Category): boolean {
  return !busted.some((b) => b.machine === machine && b.kind === kind);
}

/** The bonus asks about a few bugs at most, one per app first, so it never drags on. */
export const MAX_CODE_QUESTIONS = 3;

export interface CodeQuestion {
  bug: BustedBug;
  /** Did the student find this bug, or is it one they missed? */
  found: boolean;
}

/**
 * Bugs the student found come first (one per app, then the rest); if that's
 * fewer than three, bugs they missed fill in, one per app in the order they
 * played, using each bug's example input. So everyone gets questions, even
 * with no bugs found.
 */
export function codeQuestions(busted: BustedBug[], machineOrder: MachineId[]): CodeQuestion[] {
  const firstPerApp = busted.filter((b, i) => busted.findIndex((o) => o.machine === b.machine) === i);
  const rest = busted.filter((b) => !firstPerApp.includes(b));
  const found = [...firstPerApp, ...rest].map((bug) => ({ bug, found: true }));
  const missedByApp = machineOrder.map((id) =>
    MACHINES[id].bugs.filter((k) => !busted.some((b) => b.machine === id && b.kind === k.kind)).map((k) => ({ machine: id, kind: k.kind, inputs: k.example })),
  );
  const missed: CodeQuestion[] = [];
  for (let round = 0; missedByApp.some((list) => list.length > round); round++)
    for (const list of missedByApp) if (list[round]) missed.push({ bug: list[round], found: false });
  const all = [...found, ...missed];
  const picked = all.slice(0, MAX_CODE_QUESTIONS);
  // Most bugs are a missing check: make sure one question is about a wrong line, if there is one.
  const kindOf = (q: CodeQuestion) => (q.bug.machine === "raffle" ? RAFFLE.fixFor(q.bug.kind) : MACHINES[q.bug.machine].fixFor(q.bug.kind, q.bug.inputs)).type;
  if (picked.length === MAX_CODE_QUESTIONS && picked.every((q) => kindOf(q) === "missing_line")) {
    const wrongLine = all.slice(MAX_CODE_QUESTIONS).find((q) => kindOf(q) === "wrong_line");
    if (wrongLine) picked[MAX_CODE_QUESTIONS - 1] = wrongLine;
  }
  return picked;
}

/** Bugs busted in the three apps (older sessions also had a bonus app, which doesn't count). */
export const measuredBugs = (busted: BustedBug[]) => busted.filter((b) => b.machine !== "raffle").length;

/** Where the progress bar is: 0 questions, 1 practice, 2–4 the apps, 5 code questions, 6 done. */
export function progressStage(screen: Screen, machineIndex: number): number {
  if (screen === "intake_coding" || screen === "intake_ai") return 0;
  if (screen === "intro" || screen === "tutorial" || screen === "ready") return 1;
  if (screen === "briefing" || screen === "machine" || screen === "between") return 2 + machineIndex;
  if (screen === "code") return 5;
  return 6;
}

export function categoryCounts(tries: Try[]): Partial<Record<Category, number>> {
  const counts: Partial<Record<Category, number>> = {};
  for (const t of tries) for (const c of t.categories) counts[c] = (counts[c] ?? 0) + 1;
  return counts;
}

export const isEdge = (t: Try) => !(t.categories.length === 1 && t.categories[0] === "normal");

const key = (id: string) => `bh_game_${id}`;

export function loadGame(sessionId: string): GameState | null {
  try {
    const raw = window.sessionStorage.getItem(key(sessionId));
    const g = raw ? (JSON.parse(raw) as GameState) : null;
    return g && Array.isArray(g.busted) ? g : null;
  } catch {
    return null;
  }
}

export function saveGame(sessionId: string, g: GameState): void {
  try {
    window.sessionStorage.setItem(key(sessionId), JSON.stringify(g));
  } catch {}
}

export function clearGame(sessionId: string): void {
  try {
    window.sessionStorage.removeItem(key(sessionId));
  } catch {}
}

/** Most points the code questions can give: 2 parts each. */
export const MAX_CODE_POINTS = MAX_CODE_QUESTIONS * 2;

export const codePoints = (g: Pick<GameState, "codeScores">) => (g.codeScores ?? []).reduce((n, p) => n + (p ?? 0), 0);

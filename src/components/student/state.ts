import type { BustedBug, Progress, Step } from "@/lib/types";
import type { Category, Inputs, MachineId, Output } from "@/machines/types";

/** Screens in order. Each maps to a logged `step`. */
export type Screen =
  | "intake_coding"
  | "intake_ai"
  | "intro"
  | "tutorial"
  | "ready"
  | "machine"
  | "between"
  | "end"
  | "bonus_machine"
  | "bonus_guilty";

export const STEP_OF: Record<Screen, Step> = {
  intake_coding: "intake",
  intake_ai: "intake",
  intro: "intro",
  tutorial: "tutorial",
  ready: "intro",
  machine: "machine",
  between: "reveal",
  end: "end",
  bonus_machine: "bonus_machine",
  bonus_guilty: "bonus_guilty",
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
  bonusDone: boolean;
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
    bonusDone: false,
    guiltyIndex: 0,
  };
}

/** Rebuilds a game from the server's record when a student chose "Keep going". */
export function gameFromProgress(p: Progress, now = Date.now()): GameState {
  const screen: Screen =
    p.step === "tutorial" || p.step === "intro"
      ? "intro"
      : p.step === "machine" || p.step === "reveal"
        ? "machine"
        : p.step === "post_survey" || p.step === "end" || p.step === "bonus_machine" || p.step === "bonus_guilty"
            ? "end"
            : "intake_coding";
  return { ...newGame(now), screen, machineIndex: Math.min(2, Math.max(0, p.machineIndex)), busted: p.busted };
}

/** Does this real bug add to the counter? Not if the same kind was already busted on this machine. */
export function isNewBug(busted: BustedBug[], machine: MachineId | "raffle", kind: Category): boolean {
  return !busted.some((b) => b.machine === machine && b.kind === kind);
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

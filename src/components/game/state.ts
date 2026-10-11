import type { Flag } from "@/lib/matching";
import type { Step } from "@/lib/types";

/**
 * Everything the game needs to resume after a reload, kept in localStorage
 * per session. The event log is the research record; this is only UI state.
 */
export interface GameState {
  step: Step;
  stepEnteredAt: number;
  card: { when: string; should: string; edits: number };
  /** Asked right after the hunt: pass, fail or not_tried. */
  cardResult: "pass" | "fail" | "not_tried" | null;
  flags: Flag[];
  nextFlagId: number;
  huntStartedAt: number | null;
  huntEndedAt: number | null;
  huntCapped: boolean;
  aiChecks: number;
  featuresTouched: string[];
  confidence: string | null;
  fix: { glitchId: string; text: string } | null;
}

export function firstStep(surveyEnabled: boolean): Step {
  return surveyEnabled ? "survey_pre" : "meet";
}

export function nextStep(step: Step, surveyEnabled: boolean): Step {
  const order: Step[] = ["survey_pre", "meet", "card", "hunt", "done", "reveal", "fix", "survey_post", "end"];
  let i = order.indexOf(step) + 1;
  if (!surveyEnabled && order[i] === "survey_post") i += 1;
  return order[Math.min(i, order.length - 1)];
}

export function newGame(surveyEnabled: boolean, now = Date.now()): GameState {
  return {
    step: firstStep(surveyEnabled),
    stepEnteredAt: now,
    card: { when: "", should: "", edits: 0 },
    cardResult: null,
    flags: [],
    nextFlagId: 1,
    huntStartedAt: null,
    huntEndedAt: null,
    huntCapped: false,
    aiChecks: 0,
    featuresTouched: [],
    confidence: null,
    fix: null,
  };
}

const key = (sessionId: string) => `bh_game_${sessionId}`;

export function loadGame(sessionId: string): GameState | null {
  try {
    const raw = window.localStorage.getItem(key(sessionId));
    return raw ? (JSON.parse(raw) as GameState) : null;
  } catch {
    return null;
  }
}

export function saveGame(sessionId: string, state: GameState): void {
  try {
    window.localStorage.setItem(key(sessionId), JSON.stringify(state));
  } catch {}
}

export function clearGame(sessionId: string): void {
  try {
    window.localStorage.removeItem(key(sessionId));
  } catch {}
}

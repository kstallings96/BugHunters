import type { TestCard, Verdict } from "@/lib/cards";
import type { Step } from "@/lib/types";

/**
 * Everything the game needs to resume after a reload, kept in localStorage
 * per session. The event log is the research record; this is only UI state.
 */

export type RoundPhase = "write" | "test" | "feedback";

export interface CardDraft {
  when: string;
  whenSource: "chip" | "typed";
  should: string;
  shouldItem: string | null;
  /** The AI checker's verdict on this card, if the student asked. */
  aiVerdict: Verdict | null;
}

export interface GameState {
  step: Step;
  stepEnteredAt: number;
  /** Testing rounds: write a card, test it, get feedback. */
  phase: RoundPhase;
  phaseEnteredAt: number;
  draft: CardDraft;
  cards: TestCard[];
  testStartedAt: number | null;
  testEndedAt: number | null;
  capped: boolean;
  aiChecks: number;
  featuresTouched: string[];
  confidence: string | null;
  fix: { glitchId: string; text: string } | null;
}

/** Most cards a student can write before the game moves on. */
export const MAX_CARDS = 8;

export const emptyDraft: CardDraft = { when: "", whenSource: "chip", should: "", shouldItem: null, aiVerdict: null };

export function firstStep(surveyEnabled: boolean): Step {
  return surveyEnabled ? "survey_pre" : "meet";
}

export function nextStep(step: Step, surveyEnabled: boolean): Step {
  const order: Step[] = ["survey_pre", "meet", "test", "done", "reveal", "fix", "survey_post", "end"];
  let i = order.indexOf(step) + 1;
  if (!surveyEnabled && order[i] === "survey_post") i += 1;
  return order[Math.min(i, order.length - 1)];
}

export function newGame(surveyEnabled: boolean, now = Date.now()): GameState {
  return {
    step: firstStep(surveyEnabled),
    stepEnteredAt: now,
    phase: "write",
    phaseEnteredAt: now,
    draft: emptyDraft,
    cards: [],
    testStartedAt: null,
    testEndedAt: null,
    capped: false,
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
    const g = raw ? (JSON.parse(raw) as GameState) : null;
    // A game saved by an older build has a different shape: start fresh.
    return g && Array.isArray(g.cards) ? g : null;
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

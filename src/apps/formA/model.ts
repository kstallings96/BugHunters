/**
 * Game logic for "Maya's Times Tables": the app an AI supposedly built.
 * Pure functions so each planted glitch can be unit-tested.
 *
 * Planted glitches (see src/content/formA.ts for the student-facing text):
 *   visible      a countdown bar (TIMER_SECONDS) though Maya said no timer
 *   interaction  question 5 is 2 × 3, outside the 6, 7, 8 tables
 *   sequence     a missed question is never asked again
 *   broken       tapping an answer during feedback skips the next question
 * Red herrings: the purple theme (requested) and an owl (harmless extra).
 */

export interface Question {
  a: number;
  b: number;
  choices: number[];
}

/** Fixed order so every student meets the same app. */
export const QUESTIONS: Question[] = [
  { a: 6, b: 3, choices: [18, 16, 21, 24] },
  { a: 7, b: 4, choices: [24, 21, 28, 32] },
  { a: 8, b: 2, choices: [10, 16, 18, 14] },
  { a: 6, b: 7, choices: [36, 48, 49, 42] },
  { a: 2, b: 3, choices: [5, 6, 8, 9] }, // the interaction glitch
  { a: 8, b: 6, choices: [48, 42, 54, 56] },
  { a: 7, b: 8, choices: [54, 63, 56, 48] },
  { a: 6, b: 9, choices: [56, 54, 45, 63] },
  { a: 8, b: 4, choices: [28, 36, 24, 32] },
  { a: 7, b: 6, choices: [42, 48, 36, 49] },
  { a: 6, b: 6, choices: [30, 36, 42, 32] },
  { a: 8, b: 8, choices: [56, 72, 64, 48] },
];

export const GLITCH_QUESTION_INDEX = 4;
export const TIMER_SECONDS = 8;
export const FEEDBACK_MS = 1300;

export type Phase = "start" | "question" | "feedback" | "finished";

export interface State {
  phase: Phase;
  /** Index into QUESTIONS of the question on screen. */
  index: number;
  stars: number;
  /** Taps on an answer while feedback was showing (the broken glitch). */
  extraTaps: number;
  last: { chosen: number; correct: boolean } | null;
  /** Indexes answered wrong. Recorded, but never asked again (the sequence glitch). */
  missed: number[];
}

export type Action =
  | { type: "start" }
  | { type: "answer"; choice: number }
  | { type: "advance" }
  | { type: "restart" };

/** Things that happened inside the app, logged as app_event for analysis. */
export type AppEvent =
  | { type: "question_shown"; index: number; a: number; b: number }
  | { type: "answered"; index: number; choice: number; correct: boolean }
  | { type: "extra_tap"; index: number }
  | { type: "question_skipped"; index: number; a: number; b: number }
  | { type: "finished"; stars: number; missed: number }
  | { type: "restarted" };

export const initialState: State = { phase: "start", index: 0, stars: 0, extraTaps: 0, last: null, missed: [] };

export const answerOf = (q: Question) => q.a * q.b;

function show(index: number): AppEvent {
  const q = QUESTIONS[index];
  return { type: "question_shown", index, a: q.a, b: q.b };
}

export function step(state: State, action: Action): { state: State; events: AppEvent[] } {
  switch (action.type) {
    case "start":
    case "restart": {
      if (action.type === "start" && state.phase !== "start") return { state, events: [] };
      const events: AppEvent[] = action.type === "restart" ? [{ type: "restarted" }] : [];
      return { state: { ...initialState, phase: "question" }, events: [...events, show(0)] };
    }

    case "answer": {
      if (state.phase === "question") {
        const correct = answerOf(QUESTIONS[state.index]) === action.choice;
        return {
          state: {
            ...state,
            phase: "feedback",
            stars: state.stars + (correct ? 1 : 0),
            last: { chosen: action.choice, correct },
            // A correct app would put this question back in the queue.
            missed: correct ? state.missed : [...state.missed, state.index],
          },
          events: [{ type: "answered", index: state.index, choice: action.choice, correct }],
        };
      }
      if (state.phase === "feedback") {
        // GLITCH (broken): the extra tap is counted as an answer to the
        // next question, which then gets skipped.
        return { state: { ...state, extraTaps: state.extraTaps + 1 }, events: [{ type: "extra_tap", index: state.index }] };
      }
      return { state, events: [] };
    }

    case "advance": {
      if (state.phase !== "feedback") return { state, events: [] };
      const events: AppEvent[] = [];
      let next = state.index + 1;
      for (let i = 0; i < state.extraTaps && next < QUESTIONS.length; i++) {
        const q = QUESTIONS[next];
        events.push({ type: "question_skipped", index: next, a: q.a, b: q.b });
        next += 1;
      }
      if (next >= QUESTIONS.length) {
        events.push({ type: "finished", stars: state.stars, missed: state.missed.length });
        return { state: { ...state, phase: "finished", extraTaps: 0, last: null }, events };
      }
      events.push(show(next));
      return { state: { ...state, phase: "question", index: next, extraTaps: 0, last: null }, events };
    }
  }
}

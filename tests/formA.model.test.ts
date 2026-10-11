import { describe, expect, it } from "vitest";
import {
  answerOf,
  GLITCH_QUESTION_INDEX,
  initialState,
  QUESTIONS,
  step,
  TIMER_SECONDS,
  type Action,
  type AppEvent,
  type State,
} from "@/apps/formA/model";

function run(actions: Action[], from: State = initialState) {
  let state = from;
  const events: AppEvent[] = [];
  for (const a of actions) {
    const r = step(state, a);
    state = r.state;
    events.push(...r.events);
  }
  return { state, events };
}

const right = (i: number): Action => ({ type: "answer", choice: answerOf(QUESTIONS[i]) });
const wrong = (i: number): Action => ({ type: "answer", choice: QUESTIONS[i].choices.find((c) => c !== answerOf(QUESTIONS[i]))! });
const ADV: Action = { type: "advance" };

/** Answer every question correctly from the current one to the end. */
function playToEnd(state: State) {
  const actions: Action[] = [];
  for (let i = state.index; i < QUESTIONS.length; i++) actions.push(right(i), ADV);
  return run(actions, state);
}

describe("Form A content sanity", () => {
  it("every question has its answer among four distinct choices", () => {
    for (const q of QUESTIONS) {
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices).toContain(answerOf(q));
    }
  });
  it("only the planted question is outside the 6, 7, 8 tables", () => {
    QUESTIONS.forEach((q, i) => {
      if (i === GLITCH_QUESTION_INDEX) expect([q.a, q.b]).toEqual([2, 3]);
      else expect([6, 7, 8]).toContain(q.a);
    });
  });
  it("the correct answer is not always in the same spot", () => {
    const spots = new Set(QUESTIONS.map((q) => q.choices.indexOf(answerOf(q))));
    expect(spots.size).toBeGreaterThan(2);
  });
});

describe("Form A glitches", () => {
  it("visible: there is a countdown timer", () => {
    expect(TIMER_SECONDS).toBeGreaterThan(0);
  });

  it("interaction: question 5 is 2 × 3, but only after playing a few rounds", () => {
    const actions: Action[] = [{ type: "start" }];
    for (let i = 0; i < GLITCH_QUESTION_INDEX; i++) actions.push(right(i), ADV);
    const { state, events } = run(actions);
    const shown = events.filter((e) => e.type === "question_shown");
    expect(shown.slice(0, -1).every((e) => e.type === "question_shown" && e.a !== 2)).toBe(true);
    expect(QUESTIONS[state.index]).toMatchObject({ a: 2, b: 3 });
    expect(shown.at(-1)).toMatchObject({ index: 4, a: 2, b: 3 });
  });

  it("sequence: a missed question never comes back", () => {
    const start = run([{ type: "start" }, wrong(0), ADV]);
    expect(start.state.missed).toEqual([0]);
    const end = playToEnd(start.state);
    const shownAgain = end.events.filter((e) => e.type === "question_shown" && e.index === 0);
    expect(shownAgain).toHaveLength(0);
    expect(end.state.phase).toBe("finished");
    expect(end.events.at(-1)).toMatchObject({ type: "finished", missed: 1 });
  });

  it("broken: tapping an answer twice skips the next question", () => {
    const { state, events } = run([{ type: "start" }, right(0), right(0), ADV]);
    expect(events.map((e) => e.type)).toEqual(["question_shown", "answered", "extra_tap", "question_skipped", "question_shown"]);
    expect(events).toContainEqual({ type: "question_skipped", index: 1, a: 7, b: 4 });
    expect(state.index).toBe(2);
  });

  it("broken: a single tap does not skip anything", () => {
    const { state, events } = run([{ type: "start" }, right(0), ADV]);
    expect(events.some((e) => e.type === "question_skipped")).toBe(false);
    expect(state.index).toBe(1);
  });

  it("stars count right answers; play again starts over", () => {
    const first = run([{ type: "start" }, right(0), ADV, wrong(1), ADV]);
    expect(first.state.stars).toBe(1);
    const again = run([{ type: "restart" }], first.state);
    expect(again.state).toMatchObject({ phase: "question", index: 0, stars: 0, missed: [] });
  });
});

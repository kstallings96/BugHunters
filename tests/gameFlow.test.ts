import { describe, expect, it } from "vitest";
import { nextStep } from "@/components/game/state";
import { formA } from "@/content/formA";
import { matchFlag, summarize, type Flag } from "@/lib/matching";

let id = 0;
function flag(over: Partial<Flag>): Flag {
  return {
    id: ++id,
    kind: "spot",
    feature: null,
    x: 50,
    y: 50,
    reason: "mismatch",
    requestItem: null,
    text: "",
    createdAt: "2026-10-11T15:00:00Z",
    ...over,
  };
}

describe("step order", () => {
  it("runs the six steps, with the survey only when enabled", () => {
    const walk = (survey: boolean) => {
      const steps = [survey ? "survey_pre" : "meet"];
      while (steps.at(-1) !== "end") steps.push(nextStep(steps.at(-1) as never, survey));
      return steps;
    };
    expect(walk(false)).toEqual(["meet", "card", "hunt", "done", "reveal", "fix", "end"]);
    expect(walk(true)).toEqual(["survey_pre", "meet", "card", "hunt", "done", "reveal", "fix", "survey_post", "end"]);
  });
});

describe("matching flags to Form A glitches", () => {
  it("matches by request item", () => {
    expect(matchFlag(flag({ feature: "countdown_bar", requestItem: "no_timer" }), formA)).toEqual({ kind: "glitch", id: "timer", certain: true });
    expect(matchFlag(flag({ feature: "question", requestItem: "tables" }), formA)?.id).toBe("two_times_three");
    expect(matchFlag(flag({ kind: "something", feature: null, x: null, y: null, requestItem: "ask_again" }), formA)?.id).toBe("never_again");
  });

  it("request item wins over location", () => {
    // Flagged the bar but blamed the wrong request item: not the timer glitch.
    expect(matchFlag(flag({ feature: "countdown_bar", requestItem: "tables" }), formA)?.id).toBe("two_times_three");
  });

  it("'broken' matches the broken glitch tentatively (for review)", () => {
    expect(matchFlag(flag({ reason: "broken", feature: "answer_button" }), formA)).toEqual({ kind: "glitch", id: "double_tap", certain: false });
    expect(matchFlag(flag({ reason: "broken", kind: "something", feature: null }), formA)?.id).toBe("double_tap");
    expect(matchFlag(flag({ reason: "broken", feature: "title" }), formA)).toBeNull();
  });

  it("counts false alarms on the red herrings", () => {
    expect(matchFlag(flag({ feature: "background", requestItem: "purple" }), formA)).toEqual({ kind: "red_herring", id: "purple" });
    expect(matchFlag(flag({ feature: "owl", requestItem: "other" }), formA)).toEqual({ kind: "red_herring", id: "owl" });
    expect(matchFlag(flag({ feature: "owl", reason: "broken" }), formA)).toEqual({ kind: "red_herring", id: "owl" });
  });

  it("'I just don't like it' is never a glitch or a false alarm", () => {
    expect(matchFlag(flag({ feature: "owl", reason: "dislike" }), formA)).toBeNull();
    expect(matchFlag(flag({ feature: "countdown_bar", reason: "dislike" }), formA)).toBeNull();
  });

  it("summarizes found, missed and red herrings in content order", () => {
    const s = summarize(
      [
        flag({ reason: "broken", feature: "answer_button" }),
        flag({ feature: "countdown_bar", requestItem: "no_timer" }),
        flag({ feature: "countdown_bar", requestItem: "no_timer" }),
        flag({ feature: "owl", requestItem: "other" }),
      ],
      formA,
    );
    expect(s).toEqual({ found: ["timer", "double_tap"], missed: ["two_times_three", "never_again"], redHerringsFlagged: ["owl"] });
  });
});

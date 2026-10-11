import { describe, expect, it } from "vitest";
import { nextStep } from "@/components/game/state";
import { formA } from "@/content/formA";
import { aiVerdictFor, judge, starsFor, summarizeCards, totalStars, truthFor, type TestCard } from "@/lib/cards";

function card(
  shouldItem: string | null,
  verdict: "pass" | "fail",
  aiVerdict: "pass" | "fail" | null = null,
  round = 1,
  over: Partial<TestCard> = {},
): TestCard {
  return { round, when: "get one wrong", whenSource: "chip", should: "x", shouldItem, verdict, aiVerdict, interactions: 0, ...over };
}

describe("step order", () => {
  it("meet → test → done → reveal → fix → end, with the survey only when enabled", () => {
    const walk = (survey: boolean) => {
      const steps = [survey ? "survey_pre" : "meet"];
      while (steps.at(-1) !== "end") steps.push(nextStep(steps.at(-1) as never, survey));
      return steps;
    };
    expect(walk(false)).toEqual(["meet", "test", "done", "reveal", "fix", "end"]);
    expect(walk(true)).toEqual(["survey_pre", "meet", "test", "done", "reveal", "fix", "survey_post", "end"]);
  });
});

describe("Form A ground truth", () => {
  it("three requests are broken, two work", () => {
    const truth = Object.fromEntries(formA.requestItems.map((r) => [r.id, truthFor(r.id, formA).truth]));
    expect(truth).toEqual({ tables: "fail", big_buttons: "pass", no_timer: "fail", ask_again: "fail", purple: "pass" });
  });
  it("every chip-targetable glitch has a request item, and each item has a 'should' phrase", () => {
    for (const r of formA.requestItems) expect(r.should.length).toBeGreaterThan(3);
    expect(formA.glitches.filter((g) => g.requestItem).map((g) => g.id)).toEqual(["timer", "two_times_three", "never_again"]);
  });
});

describe("judging a card", () => {
  it("fail on a broken request catches the glitch", () => {
    expect(judge(card("ask_again", "fail"), formA)).toEqual({ outcome: "caught", truth: "fail", glitchId: "never_again" });
  });
  it("pass on a broken request misses it", () => {
    expect(judge(card("tables", "pass"), formA).outcome).toBe("missed");
  });
  it("pass on a working request is confirmed; fail is a false alarm", () => {
    expect(judge(card("purple", "pass"), formA).outcome).toBe("confirmed");
    expect(judge(card("big_buttons", "fail"), formA).outcome).toBe("false_alarm");
  });
  it("typed expectations are left for a person to judge", () => {
    expect(judge(card(null, "fail"), formA)).toEqual({ outcome: "unscored", truth: null, glitchId: null });
  });
});

describe("the scripted AI checker", () => {
  it("only says fail for the visible timer glitch; passes everything else, wrongly or not", () => {
    expect(aiVerdictFor("no_timer", formA).verdict).toBe("fail");
    for (const item of ["tables", "ask_again", "purple", "big_buttons", null]) expect(aiVerdictFor(item, formA).verdict).toBe("pass");
    expect(aiVerdictFor("tables", formA).text).toBe(formA.checker.passText);
  });
});

describe("summarizing cards", () => {
  it("counts glitches caught, right verdicts, and AI mistakes", () => {
    const s = summarizeCards(
      [
        card("no_timer", "fail", "fail", 1),
        card("ask_again", "pass", "pass", 2), // trusted the AI, which was wrong
        card("purple", "pass", null, 3),
        card(null, "fail", null, 4),
        card("no_timer", "fail", null, 5),
      ],
      formA,
    );
    expect(s).toEqual({ found: ["timer"], missed: ["two_times_three", "never_again", "double_tap"], correct: 3, scored: 4, aiWrong: 1, aiAsked: 2 });
  });
});

describe("stars", () => {
  it("a caught glitch, tested in the app, with a new idea earns all four", () => {
    expect(starsFor(card("no_timer", "fail", null, 1, { interactions: 3 }), [], formA)).toEqual({
      tried: true,
      right: true,
      caught: true,
      ownIdea: true,
      total: 4,
    });
  });
  it("a right 'passed' on a working request earns 'right' but not 'caught'", () => {
    expect(starsFor(card("purple", "pass", null, 1, { interactions: 1 }), [], formA)).toMatchObject({ right: true, caught: false, total: 3 });
  });
  it("a wrong verdict still earns stars for effort, never fewer than zero", () => {
    expect(starsFor(card("tables", "pass"), [], formA)).toMatchObject({ right: false, caught: false, tried: false, ownIdea: true, total: 1 });
  });
  it("reusing the same action is not a new idea, but typing your own always is", () => {
    const first = card("tables", "fail", null, 1);
    expect(starsFor(card("no_timer", "fail", null, 2), [first], formA).ownIdea).toBe(false);
    expect(starsFor(card("no_timer", "fail", null, 2, { when: "Get One Wrong " }), [first], formA).ownIdea).toBe(false);
    expect(starsFor(card("no_timer", "fail", null, 2, { whenSource: "typed" }), [first], formA).ownIdea).toBe(true);
  });
  it("totals add up across cards", () => {
    const cards = [card("tables", "fail", null, 1, { interactions: 5 }), card("big_buttons", "pass", null, 2, { when: "tap an answer" })];
    expect(totalStars(cards, formA)).toBe(4 + 2);
  });
});

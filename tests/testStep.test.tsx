// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { newGame, type GameState } from "@/components/game/state";
import { TestStep } from "@/components/game/TestStep";
import { formA } from "@/content/formA";

const logged: { type: string; payload: Record<string, unknown> }[] = [];
vi.mock("@/lib/logger", () => ({
  logEvent: (type: string, payload: Record<string, unknown> = {}) => logged.push({ type, payload }),
}));

/** Renders TestStep with a tiny in-test store standing in for Game. */
function setup(over: Partial<GameState> = {}, aiChecker = false) {
  let game: GameState = { ...newGame(false), step: "test", testStartedAt: Date.now(), phaseEnteredAt: Date.now(), ...over };
  const onFinish = vi.fn();
  const view = () => (
    <TestStep form={formA} game={game} capSeconds={600} aiChecker={aiChecker} onUpdate={(p) => ((game = { ...game, ...p }), rerender())} onFinish={onFinish} />
  );
  const utils = render(view());
  function rerender() {
    utils.rerender(view());
  }
  return { onFinish, game: () => game };
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

/** Writes the current card with an action chip and sends it to testing. */
function writeCard(when: string) {
  click(when);
  click(/Test it/);
}

describe("one test card per request", () => {
  beforeEach(() => {
    logged.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("walks Maya's requests in order; the 'it should' part is filled in", () => {
    setup();
    expect(screen.getByText(/Card 1 of 5: Only 6, 7, and 8 times tables/)).toBeTruthy();
    expect(screen.getByText(/it should only ask 6, 7, and 8 times tables\./)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull(); // no app while writing
    expect((screen.getByRole("button", { name: /Test it/ }) as HTMLButtonElement).disabled).toBe(true);
    writeCard("play for a while");
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(logged.find((e) => e.type === "card_submit")?.payload).toMatchObject({ round: 1, request_item: "tables", when: "play for a while" });
  });

  it("stars: caught + right + tried + new idea, listed only when earned", () => {
    const t = setup();
    writeCard("play for a while");
    click("Start");
    click(/It failed/);
    expect(screen.getByText("Your card caught a glitch!")).toBeTruthy();
    for (const s of ["You caught a glitch!", "Right answer!", "You tried it in Maya's app.", "A new test idea!"]) {
      expect(screen.getByText(`+⭐ ${s}`)).toBeTruthy();
    }
    expect(screen.getAllByLabelText("4 stars").length).toBeGreaterThan(0);
    expect(t.game().cards[0]).toMatchObject({ shouldItem: "tables", verdict: "fail", interactions: 1 });
    expect(logged.find((e) => e.type === "card_feedback")?.payload).toMatchObject({ outcome: "caught", stars_total: 4 });
  });

  it("a wrong verdict says look again, never lists missing stars", () => {
    setup();
    writeCard("play for a while");
    click(/It passed/);
    expect(screen.getByText("Look again!")).toBeTruthy();
    expect(screen.getByText(/Question 5 is 2 × 3/)).toBeTruthy();
    expect(screen.queryByText(/Right answer/)).toBeNull();
    expect(screen.getByText("+⭐ A new test idea!")).toBeTruthy();
  });

  it("moves to the next request, with a fresh app, and the checklist shows progress", () => {
    setup();
    writeCard("play for a while");
    click(/It failed/);
    click(/Next card/);
    expect(logged.at(-1)).toMatchObject({ type: "round_start", payload: { round: 2, request_item: "big_buttons" } });
    expect(screen.getByText(/Card 2 of 5: Big buttons/)).toBeTruthy();
    expect(screen.getByText("❌")).toBeTruthy(); // card 1 in the checklist
    writeCard("tap an answer");
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("your own idea can be typed", () => {
    setup();
    click(/my own idea/);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "wait and watch" } });
    click(/Test it/);
    expect(logged.find((e) => e.type === "card_submit")?.payload).toMatchObject({ when: "wait and watch", when_source: "typed" });
  });

  it("after the fifth card, the rounds end", () => {
    const t = setup();
    const actions = ["play for a while", "tap an answer", "look at the screen", "get one wrong", "play to the end"];
    actions.forEach((a, i) => {
      writeCard(a);
      click(/It failed/);
      click(i < 4 ? /Next card/ : /All done/);
    });
    expect(t.onFinish).toHaveBeenCalledWith(false);
    expect(t.game().cards.map((c) => c.shouldItem)).toEqual(["tables", "big_buttons", "no_timer", "ask_again", "purple"]);
  });

  it("the AI checker only appears in the AI condition, and its verdict is recorded with the card", () => {
    setup({}, false);
    writeCard("play for a while");
    expect(screen.queryByText(/Ask the AI/)).toBeNull();
    cleanup();
    logged.length = 0;
    const t = setup({}, true);
    writeCard("play for a while");
    click(/Ask the AI/);
    act(() => vi.advanceTimersByTime(1600));
    expect(screen.getByText(formA.checker.passText)).toBeTruthy();
    click("OK");
    click(/It passed/);
    expect(logged.find((e) => e.type === "card_run")?.payload).toMatchObject({ verdict: "pass", ai_verdict: "pass", agreed_with_ai: true });
    expect(t.game().cards[0].aiVerdict).toBe("pass");
  });

  it("the hidden time cap stops testing gently", () => {
    const t = setup({ testStartedAt: Date.now() - 599_000 });
    expect(screen.queryByText(/Time to stop testing/)).toBeNull();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText(/Time to stop testing/)).toBeTruthy();
    click("OK");
    expect(t.onFinish).toHaveBeenCalledWith(true);
  });
});

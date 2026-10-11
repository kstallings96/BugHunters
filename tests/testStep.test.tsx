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
    <TestStep form={formA} game={game} capSeconds={480} aiChecker={aiChecker} onUpdate={(p) => ((game = { ...game, ...p }), rerender())} onFinish={onFinish} />
  );
  const utils = render(view());
  function rerender() {
    utils.rerender(view());
  }
  return { onFinish, game: () => game };
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

function writeCard(when: string, should: RegExp) {
  click(when);
  click(should);
  click(/Test it/);
}

describe("test-card rounds", () => {
  beforeEach(() => {
    logged.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("one thing at a time: the app only appears after a card is written", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect((screen.getByRole("button", { name: /Test it/ }) as HTMLButtonElement).disabled).toBe(true);
    writeCard("get one wrong", /ask it again later/);
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(screen.getByText("When I get one wrong, it should ask it again later.")).toBeTruthy();
    expect(logged.find((e) => e.type === "card_submit")?.payload).toMatchObject({ round: 1, when_source: "chip", should_item: "ask_again" });
  });

  it("a fail verdict on a broken request celebrates a caught glitch", () => {
    const t = setup();
    writeCard("look at the screen", /have no timer/);
    click(/It failed/);
    expect(screen.getByText("Your card caught a glitch!")).toBeTruthy();
    expect(logged.find((e) => e.type === "card_feedback")?.payload).toMatchObject({ outcome: "caught", glitch_id: "timer" });
    expect(t.game().cards[0]).toMatchObject({ shouldItem: "no_timer", verdict: "fail" });
  });

  it("a pass verdict on a broken request says look again, with how to see it", () => {
    setup();
    writeCard("play for a while", /only ask 6, 7, and 8/);
    click(/It passed/);
    expect(screen.getByText("Look again!")).toBeTruthy();
    expect(screen.getByText(/Question 5 is 2 × 3/)).toBeTruthy();
  });

  it("app taps are logged with the round, and every card gets a fresh app", () => {
    setup();
    writeCard("tap an answer", /have big buttons/);
    click("Start");
    expect(logged.find((e) => e.type === "app_interaction")?.payload).toMatchObject({ round: 1, feature: "start_button" });
    click(/It passed/);
    click(/Write another card/);
    expect(logged.at(-1)).toMatchObject({ type: "round_start", payload: { round: 2 } });
    writeCard("look at the screen", /be purple/);
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(screen.getByText(/My cards|Card 2/)).toBeTruthy();
  });

  it("typed parts of a card are allowed and left unscored", () => {
    setup();
    click("get one wrong");
    // the second "my own" chip belongs to "it should…"
    fireEvent.click(screen.getAllByRole("button", { name: /my own/i })[1]);
    const box = screen.getAllByRole("textbox").at(-1)!;
    fireEvent.change(box, { target: { value: "say good job" } });
    click(/Test it/);
    click(/It failed/);
    expect(screen.getByText("Nice card!")).toBeTruthy();
    expect(logged.find((e) => e.type === "card_submit")?.payload).toMatchObject({ should_item: null, should: "say good job" });
  });

  it("the AI checker only appears in the AI condition, and its verdict is recorded with the card", () => {
    setup({}, false);
    writeCard("play for a while", /only ask 6, 7, and 8/);
    expect(screen.queryByText(/Ask the AI/)).toBeNull();
    cleanup();
    logged.length = 0;
    const t = setup({}, true);
    writeCard("play for a while", /only ask 6, 7, and 8/);
    click(/Ask the AI/);
    act(() => vi.advanceTimersByTime(1600));
    expect(screen.getByText(formA.checker.passText)).toBeTruthy();
    click("OK");
    click(/It passed/);
    expect(logged.find((e) => e.type === "card_run")?.payload).toMatchObject({ verdict: "pass", ai_verdict: "pass", agreed_with_ai: true });
    expect(t.game().cards[0].aiVerdict).toBe("pass");
  });

  it("'I'm done testing' ends the rounds", () => {
    const t = setup();
    writeCard("look at the screen", /be purple/);
    click(/It passed/);
    click(/done testing/);
    expect(t.onFinish).toHaveBeenCalledWith(false);
  });

  it("the hidden time cap stops testing gently", () => {
    const t = setup({ testStartedAt: Date.now() - 479_000 });
    expect(screen.queryByText(/Time to stop testing/)).toBeNull();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText(/Time to stop testing/)).toBeTruthy();
    click("OK");
    expect(t.onFinish).toHaveBeenCalledWith(true);
  });
});

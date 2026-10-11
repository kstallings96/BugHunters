// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HuntStep } from "@/components/game/HuntStep";
import { newGame, type GameState } from "@/components/game/state";
import { formA } from "@/content/formA";

const logged: { type: string; payload: Record<string, unknown> }[] = [];
vi.mock("@/lib/logger", () => ({
  logEvent: (type: string, payload: Record<string, unknown> = {}) => logged.push({ type, payload }),
}));

function setup(over: Partial<GameState> = {}, aiChecker = true) {
  let game: GameState = { ...newGame(false), step: "hunt", huntStartedAt: Date.now(), card: { when: "get one wrong", should: "ask me again later", edits: 2 }, ...over };
  const onDone = vi.fn();
  const utils = render(
    <HuntStep form={formA} game={game} huntCapSeconds={480} aiChecker={aiChecker} onUpdate={(p) => (game = { ...game, ...p })} onDone={onDone} />,
  );
  const rerender = () =>
    utils.rerender(
      <HuntStep form={formA} game={game} huntCapSeconds={480} aiChecker={aiChecker} onUpdate={(p) => (game = { ...game, ...p })} onDone={onDone} />,
    );
  return { ...utils, onDone, rerender, game: () => game };
}

describe("hunt step", () => {
  beforeEach(() => {
    logged.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("logs app taps in play mode with their feature", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(logged.find((e) => e.type === "app_interaction")?.payload.feature).toBe("start_button");
    expect(logged.some((e) => e.type === "app_event" && e.payload.type === "question_shown")).toBe(true);
  });

  it("the flag button, then a tap on the app, opens Why? and the app never sees that tap", () => {
    const t = setup();
    fireEvent.click(screen.getByText(/I found a glitch/));
    expect(logged.some((e) => e.type === "flag_start")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Why did you flag it?")).toBeTruthy();
    expect(logged.some((e) => e.type === "app_event")).toBe(false);
    fireEvent.click(screen.getByText(/doesn't match what Maya asked/));
    fireEvent.click(within(screen.getByRole("dialog")).getByText("No timer"));
    fireEvent.click(screen.getByText(/Save flag/));
    const created = logged.find((e) => e.type === "flag_create")!;
    expect(created.payload).toMatchObject({ feature: "start_button", reason: "mismatch", request_item: "no_timer", kind: "spot" });
    expect(t.game().flags).toHaveLength(1);
  });

  it("after a flag, taps go to the app again (no mode to switch back)", () => {
    setup();
    fireEvent.click(screen.getByText(/I found a glitch/));
    fireEvent.click(screen.getByRole("button", { name: "Owl" }));
    fireEvent.click(screen.getByText(/just don't like it/));
    fireEvent.click(screen.getByText(/Save flag/));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(logged.some((e) => e.type === "app_event" && e.payload.type === "question_shown")).toBe(true);
  });

  it("'It's not in one spot' makes a flag with no location", () => {
    const t = setup();
    fireEvent.click(screen.getByText(/I found a glitch/));
    fireEvent.click(screen.getByText(/not in one spot/));
    fireEvent.click(screen.getByText(/It's broken/));
    fireEvent.click(screen.getByText(/Save flag/));
    expect(t.game().flags[0]).toMatchObject({ kind: "something", feature: null, reason: "broken" });
  });

  it("cancelling before tapping a spot is logged", () => {
    setup();
    fireEvent.click(screen.getByText(/I found a glitch/));
    fireEvent.click(screen.getByText("Cancel"));
    expect(logged.find((e) => e.type === "flag_cancel")?.payload).toMatchObject({ stage: "pick" });
    expect(screen.getByText(/I found a glitch/)).toBeTruthy();
  });

  it("the counter shows flags made, never a total, and opens the list to remove one", () => {
    const t = setup();
    expect(screen.getByText("🐞 Glitches found: 0")).toBeTruthy();
    fireEvent.click(screen.getByText(/I found a glitch/));
    fireEvent.click(screen.getByText(/not in one spot/));
    fireEvent.click(screen.getByText(/It's broken/));
    fireEvent.click(screen.getByText(/Save flag/));
    t.rerender();
    expect(screen.getByText("🐞 Glitches found: 1")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/of 4|\/ ?4/);
    fireEvent.click(screen.getByText("🐞 Glitches found: 1"));
    fireEvent.click(screen.getByText("Remove"));
    expect(logged.some((e) => e.type === "flag_delete")).toBe(true);
    expect(t.game().flags).toHaveLength(0);
  });

  it("the AI checker button only appears in the AI condition", () => {
    setup({}, false);
    expect(screen.queryByText(/Ask the AI/)).toBeNull();
    cleanup();
    setup({}, true);
    fireEvent.click(screen.getByText(/Ask the AI/));
    expect(logged.find((e) => e.type === "ai_check_used")?.payload).toMatchObject({ n: 1 });
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText(formA.checker.answer)).toBeTruthy();
  });

  it("the hidden time cap ends the hunt gently", () => {
    const t = setup({ huntStartedAt: Date.now() - 479_000 });
    expect(screen.queryByText(/Time to stop hunting/)).toBeNull();
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByText(/Time to stop hunting/)).toBeTruthy();
    expect(logged.some((e) => e.type === "hunt_capped")).toBe(true);
    fireEvent.click(screen.getByText("OK"));
    expect(t.onDone).toHaveBeenCalledWith(true);
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimesTablesApp } from "@/apps/formA/TimesTablesApp";
import { FEEDBACK_MS } from "@/apps/formA/model";
import { formA } from "@/content/formA";

function setup() {
  const events: { type: string; payload: Record<string, unknown> }[] = [];
  const utils = render(<TimesTablesApp onAppEvent={(type, payload) => events.push({ type, payload })} />);
  const q = () => utils.container.querySelector('[data-feature="question"]')?.textContent?.replace(/\s+/g, " ").trim();
  const answer = (n: number) => fireEvent.click(screen.getByRole("button", { name: String(n) }));
  const wait = () => act(() => vi.advanceTimersByTime(FEEDBACK_MS + 10));
  return { ...utils, events, q, answer, wait };
}

describe("Maya's Times Tables (rendered)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("tags every feature listed in the content config", () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const onScreen = new Set([...container.querySelectorAll("[data-feature]")].map((el) => el.getAttribute("data-feature")));
    for (const f of ["background", "countdown_bar", "title", "score", "question", "answer_button", "feedback", "owl"]) {
      expect(onScreen).toContain(f);
    }
    const known = new Set(formA.features.map((f) => f.id));
    for (const f of onScreen) expect(known).toContain(f);
  });

  it("every glitch and red herring points at real features", () => {
    const known = new Set(formA.features.map((f) => f.id));
    for (const item of [...formA.glitches, ...formA.redHerrings]) {
      for (const f of item.features) expect(known).toContain(f);
    }
  });

  it("visible glitch: the countdown bar animates during a question", () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const bar = container.querySelector('[data-feature="countdown_bar"] > div') as HTMLElement;
    expect(bar.style.animation).toContain("bh-countdown");
  });

  it("broken glitch: a fast double tap skips 7 × 4", () => {
    const { q, answer, wait, events } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(q()).toBe("6 × 3 = ?");
    answer(18);
    answer(18);
    wait();
    expect(q()).toBe("8 × 2 = ?");
    expect(events.map((e) => e.type)).toContain("question_skipped");
  });

  it("interaction glitch: 2 × 3 shows up as question 5", () => {
    const { q, answer, wait } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    for (const n of [18, 28, 16, 42]) {
      answer(n);
      wait();
    }
    expect(q()).toBe("2 × 3 = ?");
  });

  it("sequence glitch: after missing 6 × 3, the game ends without asking it again", () => {
    const { q, answer, wait, container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    answer(16); // wrong
    wait();
    const seen: string[] = [];
    const right = [28, 16, 42, 6, 48, 56, 54, 32, 42, 36, 64];
    for (const n of right) {
      seen.push(q()!);
      answer(n);
      wait();
    }
    expect(seen).not.toContain("6 × 3 = ?");
    expect(container.querySelector('[data-feature="finish_message"]')?.textContent).toContain("11");
  });

  it("red herrings: purple background and a harmless owl", () => {
    const { container } = setup();
    expect(container.querySelector('[data-feature="background"]')?.className).toMatch(/#8b5cf6|#6d28d9/);
    fireEvent.click(screen.getByRole("button", { name: "Owl" }));
    expect(screen.getByText("Hoot! You can do it!")).toBeTruthy();
  });
});

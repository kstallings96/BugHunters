// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DoneStep } from "@/components/game/EndSteps";

vi.mock("@/lib/logger", () => ({ logEvent: () => {} }));

describe("done step", () => {
  afterEach(cleanup);

  it("asks about the test card first, then confidence, one at a time", () => {
    const onCardResult = vi.fn();
    const onConfidence = vi.fn();
    render(<DoneStep card={{ when: "get one wrong", should: "ask me again later" }} onCardResult={onCardResult} onConfidence={onConfidence} />);
    expect(screen.getByText("Did your test card pass?")).toBeTruthy();
    expect(screen.queryByText(/How sure/)).toBeNull();
    fireEvent.click(screen.getByText("I didn't try it"));
    expect(onCardResult).toHaveBeenCalledWith("not_tried");
    expect(screen.getByText(/How sure are you/)).toBeTruthy();
    fireEvent.click(screen.getByText("Kind of sure"));
    expect(onConfidence).toHaveBeenCalledWith("kind_of_sure");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { buggyPick, judgeTap, namesOf, RAFFLE, tally, type RaffleTry } from "@/bonus/raffle";

const twenty = (text: string): RaffleTry => ({ n: 1, text, mode: "twenty", winners: Array.from({ length: 20 }, () => buggyPick(text)) });

afterEach(() => vi.restoreAllMocks());

describe("Raffle Picker (bonus, the AI's code with one planted line)", () => {
  it("reads names the way the AI's app does: trimmed, blank lines skipped", () => {
    expect(namesOf("Sam\n\n  Jay  \n")).toEqual(["Sam", "Jay"]);
    expect(namesOf("   ")).toEqual([]);
  });

  it("never picks the last name (planted), even when random is as high as it goes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9999);
    expect(buggyPick("Sam\nJay\nMaria\nLeo")).toBe("Maria");
  });

  it("handles an empty list the AI's way, and lets one name win", () => {
    expect(buggyPick("")).toBe("No names provided");
    expect(buggyPick("Sam")).toBe("Sam");
  });

  it("tapping the last name's empty bar busts the Off by one bug", () => {
    const t = twenty("Sam\nJay\nMaria\nLeo");
    expect(tally(t.text, t.winners).find((r) => r.name === "Leo")?.wins).toBe(0);
    expect(judgeTap(t, { type: "row", name: "Leo" })).toMatchObject({ verdict: "real", kind: "off_by_one" });
  });

  it("tapping a name that did win is a false alarm", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const t = twenty("Sam\nJay\nLeo");
    expect(judgeTap(t, { type: "row", name: "Sam" }).verdict).toBe("false_alarm");
    // Jay got nothing, but Jay isn't last: that could be luck.
    expect(judgeTap(t, { type: "row", name: "Jay" }).verdict).toBe("false_alarm");
  });

  it("one name winning is a Limit bug, whatever the student taps", () => {
    const one: RaffleTry = { n: 1, text: "Sam", mode: "one", winners: [buggyPick("Sam")] };
    expect(judgeTap(one, { type: "winner" })).toMatchObject({ verdict: "real", kind: "boundary" });
  });

  it("a name typed twice is debatable", () => {
    const t = twenty("Sam\nSam\nJay");
    expect(judgeTap(t, { type: "row", name: "Sam" }).verdict).toBe("debatable");
  });

  it("one pick can't show much", () => {
    const one: RaffleTry = { n: 1, text: "Sam\nJay", mode: "one", winners: ["Sam"] };
    expect(judgeTap(one, { type: "winner" }).verdict).toBe("false_alarm");
  });

  it("bonus: the planted line is line 3; the one-name check is missing after line 2", () => {
    const off = RAFFLE.fixFor("off_by_one");
    expect(off).toMatchObject({ type: "wrong_line", line: 3 });
    expect(off.options[off.answer]).toBe("spot = a random number from 0 to (count − 1)");
    const fix = RAFFLE.fixFor("boundary");
    expect(fix.type === "missing_line" && fix.validAfter).toEqual([1, 2]);
    expect(fix.type === "missing_line" && fix.options[fix.answer]).toMatch(/fewer than 2 names/);
  });
});

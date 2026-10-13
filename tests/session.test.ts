import { describe, expect, it } from "vitest";
import { machineOrder, readStudySettings, startOfToday } from "@/config/study";
import { parseBatch } from "@/lib/eventBatch";
import { isTestName, normalizeName, sameName } from "@/lib/identity";

describe("study settings", () => {
  it("defaults: periods 1-8, 180 s nudge, Central time", () => {
    expect(readStudySettings({})).toEqual({ periods: ["1", "2", "3", "4", "5", "6", "7", "8"], nudgeSeconds: 180, timeZone: "America/Chicago" });
  });
  it("reads env values", () => {
    expect(readStudySettings({ CLASS_PERIODS: " 2, 4 ,6A ", NUDGE_SECONDS: "5", SCHOOL_TIMEZONE: "America/New_York" })).toEqual({
      periods: ["2", "4", "6A"],
      nudgeSeconds: 30,
      timeZone: "America/New_York",
    });
  });
});

describe("machine order", () => {
  it("random first number machine, the other second, Name Greeter always third", () => {
    expect(machineOrder(null, () => 0.1)).toEqual({ order: ["savings", "sale", "jersey"], assignment: "random" });
    expect(machineOrder(null, () => 0.9)).toEqual({ order: ["sale", "savings", "jersey"], assignment: "random" });
  });
  it("can be forced with ?order=", () => {
    expect(machineOrder("sale")).toEqual({ order: ["sale", "savings", "jersey"], assignment: "url" });
    expect(machineOrder("Savings")).toEqual({ order: ["savings", "sale", "jersey"], assignment: "url" });
    expect(machineOrder("jersey").assignment).toBe("random");
  });
});

describe("start of today in the school's time zone", () => {
  it("is local midnight, not UTC midnight", () => {
    // 3:30 AM UTC on Oct 15 is still Oct 14 in Chicago (UTC-5 in October).
    const now = new Date("2026-10-15T03:30:00Z");
    expect(startOfToday("America/Chicago", now)).toBe("2026-10-14T05:00:00.000Z");
    expect(startOfToday("UTC", now)).toBe("2026-10-15T00:00:00.000Z");
  });
});

describe("student names", () => {
  it("trims, collapses spaces and fixes all-lower or all-caps", () => {
    expect(normalizeName("  jayden ", "r.")).toEqual({ firstName: "Jayden", lastInitial: "R" });
    expect(normalizeName("MARY  JO", "k")).toEqual({ firstName: "Mary Jo", lastInitial: "K" });
    expect(normalizeName("ana-lucía", "s")).toEqual({ firstName: "Ana-Lucía", lastInitial: "S" });
  });
  it("keeps deliberate mixed case", () => {
    expect(normalizeName("DeShawn", "w")).toEqual({ firstName: "DeShawn", lastInitial: "W" });
    expect(normalizeName("McKenzie", "b")?.firstName).toBe("McKenzie");
  });
  it("rejects anything else", () => {
    expect(normalizeName("", "S")).toBeNull();
    expect(normalizeName("Maya", "")).toBeNull();
    expect(normalizeName("M4ya", "S")).toBeNull();
    expect(normalizeName("<script>", "S")).toBeNull();
  });
  it("matches names case-insensitively", () => {
    expect(sameName({ firstName: "Jayden", lastInitial: "R" }, { firstName: "jayden", lastInitial: "r" })).toBe(true);
    expect(sameName({ firstName: "Jayden", lastInitial: "R" }, { firstName: "Jaden", lastInitial: "R" })).toBe(false);
  });
  it("names starting with Test mark test sessions", () => {
    expect(isTestName("Test")).toBe(true);
    expect(isTestName("Tester")).toBe(true);
    expect(isTestName("Tess")).toBe(false);
    expect(isTestName("Maya", "1")).toBe(true);
  });
});

describe("event batch validation", () => {
  const ok = { seq: 1, client_ts: new Date().toISOString(), step: "machine", machine: "pizza", event_type: "input_submit", payload: { x: 1 } };
  it("accepts well-formed batches, with or without a machine", () => {
    expect(parseBatch([ok])).toHaveLength(1);
    expect(parseBatch([{ ...ok, machine: null }])).toHaveLength(1);
  });
  it("rejects malformed ones", () => {
    expect(parseBatch([])).toBeNull();
    expect(parseBatch([{ ...ok, seq: 0 }])).toBeNull();
    expect(parseBatch([{ ...ok, machine: "Pizza Splitter" }])).toBeNull();
    expect(parseBatch([{ ...ok, event_type: "DROP TABLE" }])).toBeNull();
    expect(parseBatch([{ ...ok, payload: { t: "x".repeat(9000) } }])).toBeNull();
    expect(parseBatch(Array(101).fill(ok))).toBeNull();
  });
});

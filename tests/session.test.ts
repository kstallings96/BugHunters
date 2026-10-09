import { describe, expect, it } from "vitest";
import { readStudySettings } from "@/config/study";
import { assign } from "@/lib/assignment";
import { parseBatch } from "@/lib/eventBatch";
import { isTestSession, normalizeName } from "@/lib/identity";

const settings = readStudySettings({});

describe("study settings", () => {
  it("defaults: random form, 50/50 checker, 8-minute hunt cap, survey off", () => {
    expect(settings).toEqual({ defaultForm: "random", aiCheckerRatio: 0.5, huntCapSeconds: 480, surveyEnabled: false });
  });
  it("reads and clamps env values", () => {
    expect(readStudySettings({ DEFAULT_FORM: "b", AI_CHECKER_RATIO: "2", HUNT_CAP_SECONDS: "10", SURVEY_ENABLED: "TRUE" })).toEqual({
      defaultForm: "B",
      aiCheckerRatio: 1,
      huntCapSeconds: 60,
      surveyEnabled: true,
    });
  });
});

describe("assignment", () => {
  const both = ["A", "B"] as const;
  it("URL parameters win and are recorded as forced", () => {
    expect(assign({ form: "b", checker: "on" }, settings, both)).toMatchObject({
      form: "B",
      formAssignment: "url",
      condition: "ai_checker",
      conditionAssignment: "url",
    });
    expect(assign({ checker: "off" }, settings, both).condition).toBe("no_checker");
  });
  it("ignores a form that isn't built yet", () => {
    expect(assign({ form: "B" }, settings, ["A"])).toMatchObject({ form: "A", formAssignment: "default" });
  });
  it("randomizes form and condition otherwise", () => {
    expect(assign({}, settings, both, () => 0.1)).toMatchObject({ form: "A", formAssignment: "random", condition: "ai_checker" });
    expect(assign({}, settings, both, () => 0.9)).toMatchObject({ form: "B", condition: "no_checker" });
  });
  it("uses a configured default form", () => {
    expect(assign({}, { ...settings, defaultForm: "B" }, both)).toMatchObject({ form: "B", formAssignment: "default" });
  });
  it("respects the checker ratio", () => {
    const always = { ...settings, aiCheckerRatio: 1 };
    const never = { ...settings, aiCheckerRatio: 0 };
    expect(assign({}, always, both, () => 0.99).condition).toBe("ai_checker");
    expect(assign({}, never, both, () => 0).condition).toBe("no_checker");
  });
});

describe("student names", () => {
  it("accepts first name + last initial and tidies them", () => {
    expect(normalizeName("  Ana-Lucía ", "s.")).toEqual({ firstName: "Ana-Lucía", lastInitial: "S" });
    expect(normalizeName("Mary  Jo", "k")).toEqual({ firstName: "Mary Jo", lastInitial: "K" });
    expect(normalizeName("D'Andre", "W")).toEqual({ firstName: "D'Andre", lastInitial: "W" });
  });
  it("rejects anything else", () => {
    expect(normalizeName("", "S")).toBeNull();
    expect(normalizeName("Maya", "")).toBeNull();
    expect(normalizeName("Maya", "St")).toBeNull();
    expect(normalizeName("M4ya", "S")).toBeNull();
    expect(normalizeName("<script>", "S")).toBeNull();
    expect(normalizeName("a".repeat(41), "S")).toBeNull();
  });
  it("flags pilot sessions by a TEST prefix in capitals or ?test=1", () => {
    expect(isTestSession("TEST Ana")).toBe(true);
    expect(isTestSession("TESTer")).toBe(true);
    expect(isTestSession("Testa")).toBe(false);
    expect(isTestSession("Tess")).toBe(false);
    expect(isTestSession("Maya", "1")).toBe(true);
  });
});

describe("event batch validation", () => {
  const ok = { seq: 1, client_ts: new Date().toISOString(), step: "hunt", event_type: "flag_create", payload: { x: 1 } };
  it("accepts well-formed batches", () => {
    expect(parseBatch([ok])).toHaveLength(1);
  });
  it("rejects malformed ones", () => {
    expect(parseBatch([])).toBeNull();
    expect(parseBatch("nope")).toBeNull();
    expect(parseBatch([{ ...ok, seq: 0 }])).toBeNull();
    expect(parseBatch([{ ...ok, client_ts: "yesterday" }])).toBeNull();
    expect(parseBatch([{ ...ok, event_type: "DROP TABLE" }])).toBeNull();
    expect(parseBatch([{ ...ok, payload: [] }])).toBeNull();
    expect(parseBatch([{ ...ok, payload: { t: "x".repeat(9000) } }])).toBeNull();
    expect(parseBatch(Array(101).fill(ok))).toBeNull();
  });
});

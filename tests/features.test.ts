import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeQuestions, MAX_CODE_QUESTIONS, measuredBugs, progressStage } from "@/components/student/state";
import { dayKey } from "@/config/study";
import { INTAKE } from "@/config/survey";
import { hasBadWords } from "@/lib/clean";
import { normalizeName } from "@/lib/identity";
import { nicknameFor } from "@/lib/nickname";
import { fileStore, type ScoreRow } from "@/lib/server/storage";
import type { BustedBug } from "@/lib/types";
import { evaluate, MACHINES, type MachineId } from "@/machines";

const bug = (machine: BustedBug["machine"], kind: BustedBug["kind"]): BustedBug => ({ machine, kind, inputs: {} });

describe("code questions", () => {
  const order: MachineId[] = ["savings", "sale", "monster"];
  it("asks about at most 3 bugs: found ones first, one per app", () => {
    const busted = [bug("savings", "zero"), bug("savings", "negative"), bug("sale", "empty"), bug("monster", "empty"), bug("raffle", "off_by_one")];
    const qs = codeQuestions(busted, order);
    expect(qs).toHaveLength(MAX_CODE_QUESTIONS);
    expect(qs.map((q) => q.bug.machine)).toEqual(["savings", "sale", "monster"]);
    expect(qs.every((q) => q.found)).toBe(true);
  });
  it("fills in with bugs the student missed, using their example inputs", () => {
    const qs = codeQuestions([bug("sale", "empty")], order);
    expect(qs.map((q) => [q.bug.machine, q.found])).toEqual([
      ["sale", true],
      ["savings", false],
      ["sale", false],
    ]);
    expect(qs[1].bug.inputs).toEqual(MACHINES.savings.bugs[0].example);
  });
  it("still has questions when no bugs were found", () => {
    const qs = codeQuestions([], order);
    expect(qs).toHaveLength(3);
    expect(qs.every((q) => !q.found)).toBe(true);
  });
  it("every known bug's example really shows that bug", () => {
    for (const m of Object.values(MACHINES))
      for (const b of m.bugs) expect(evaluate(m, b.example, { today: new Date() }).bugKinds).toContain(b.kind);
  });
  it("mixes in a wrong-line question when every pick is a missing check", () => {
    const allMissing = [bug("sale", "empty"), bug("monster", "empty"), bug("sale", "negative")];
    const qs = codeQuestions(allMissing, order);
    const types = qs.map((q) => MACHINES[q.bug.machine as MachineId].fixFor(q.bug.kind, q.bug.inputs).type);
    expect(types).toContain("wrong_line");
    expect(qs.slice(0, 2).every((q) => q.found)).toBe(true);
  });
  it("every missing check has spots inside the code where it works", () => {
    for (const m of Object.values(MACHINES))
      for (const b of m.bugs) {
        const fix = m.fixFor(b.kind, b.example);
        if (fix.type !== "missing_line") continue;
        expect(fix.validAfter.length).toBeGreaterThan(0);
        for (const g of fix.validAfter) expect(g >= 0 && g <= m.pseudocode.length).toBe(true);
      }
  });
  it("the code calls every box by its label on screen", () => {
    for (const id of ["savings", "sale", "monster"] as const) {
      const m = MACHINES[id];
      const labels = m.fields.map((f) => f.label.replace(/\s*\(.*\)$/, ""));
      const lines = [...m.pseudocode, ...m.bugs.flatMap((b) => m.fixFor(b.kind, b.example).options)];
      for (const line of lines) {
        expect(line, `${id}: ${line}`).not.toMatch(/what you typed/);
        for (const [, box] of line.matchAll(/\bthe ([A-Z%][\w% ]*?) box/g)) expect(labels, `${id}: ${line}`).toContain(box);
        // Names in the code are the labels in lowercase ("% off", not "off").
        for (const f of m.fields) {
          const name = f.label.replace(/\s*\(.*\)$/, "").toLowerCase();
          if (name !== f.id) expect(line.replace(new RegExp(name.replace(/[%$]/g, "\\$&"), "gi"), ""), `${id}: ${line}`).not.toMatch(new RegExp(`\\b${f.id}\\b`));
        }
      }
    }
  });
  it("the leaderboard counts only the three apps", () => {
    expect(measuredBugs([bug("savings", "zero"), bug("raffle", "off_by_one")])).toBe(1);
  });
});

describe("progress bar", () => {
  it("moves through questions, practice, the three apps, done", () => {
    expect(progressStage("intake_ai", 0)).toBe(0);
    expect(progressStage("tutorial", 0)).toBe(1);
    expect(progressStage("briefing", 0)).toBe(2);
    expect(progressStage("between", 2)).toBe(4);
    expect(progressStage("code", 2)).toBe(5);
    expect(progressStage("end", 2)).toBe(6);
  });
});

describe("intake", () => {
  it("is two 5-point items with a label and an example on every choice", () => {
    for (const q of INTAKE) {
      expect(q.choices).toHaveLength(5);
      for (const c of q.choices) expect(c.label && c.example).toBeTruthy();
    }
    expect(INTAKE[0].choices[0].label).toBe("Never");
  });
});

describe("nicknames and names", () => {
  it("gives a session the same clean nickname every time", () => {
    const id = "6f1c2c1e-0000-4000-8000-000000000001";
    expect(nicknameFor(id)).toBe(nicknameFor(id));
    expect(nicknameFor(id)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/);
    const many = Array.from({ length: 300 }, (_, i) => nicknameFor(`session-${i}`));
    expect(many.some(hasBadWords)).toBe(false);
    expect(new Set(many).size).toBeGreaterThan(290);
  });
  it("refuses a login name with a bad word", () => {
    expect(normalizeName("Jayden", "R")).not.toBeNull();
    expect(normalizeName("Fuck", "R")).toBeNull();
  });
});

describe("leaderboard scores (file store)", () => {
  it("keeps one score per session, all periods together, per day", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "bh-scores-"));
    try {
      const store = fileStore(dir);
      const day = dayKey("America/Chicago", new Date("2026-10-14T15:00:00Z"));
      expect(day).toBe("2026-10-14");
      const row = (id: string, bugs: number, period = "3"): ScoreRow => ({
        session_id: id,
        nickname: nicknameFor(id),
        bugs,
        class_period: period,
        day,
        is_test: false,
        updated_at: "2026-10-14T15:00:00.000Z",
      });
      const a = "6f1c2c1e-0000-4000-8000-000000000001";
      const b = "6f1c2c1e-0000-4000-8000-000000000002";
      await store.putScore(row(a, 3));
      await store.putScore(row(a, 5));
      await store.putScore(row(b, 2, "4"));
      const today = await store.listScores(day);
      expect(today).toHaveLength(2);
      expect(today.find((s) => s.session_id === a)?.bugs).toBe(5);
      expect(today.map((s) => s.class_period).sort()).toEqual(["3", "4"]);
      expect(await store.listScores("2026-10-15")).toEqual([]);
      await expect(store.listScores("../x")).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

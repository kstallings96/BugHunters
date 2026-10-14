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

const bug = (machine: BustedBug["machine"], kind: BustedBug["kind"]): BustedBug => ({ machine, kind, inputs: {} });

describe("code questions (bonus)", () => {
  it("asks about at most 3 bugs, one per app first", () => {
    const busted = [bug("savings", "zero"), bug("savings", "negative"), bug("sale", "empty"), bug("monster", "empty"), bug("raffle", "off_by_one")];
    const qs = codeQuestions(busted);
    expect(qs).toHaveLength(MAX_CODE_QUESTIONS);
    expect(qs.map((b) => b.machine)).toEqual(["savings", "sale", "monster"]);
    expect(codeQuestions([bug("savings", "zero"), bug("savings", "rounding")])).toHaveLength(2);
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
    expect(progressStage("end", 2)).toBe(5);
    expect(progressStage("bonus_guilty", 2)).toBe(5);
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

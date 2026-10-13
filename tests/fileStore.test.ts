import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileStore, progressFrom, type EventRow, type SessionRow, type StudentRow } from "@/lib/server/storage";

const sid = "6f1c2c1e-0000-4000-8000-000000000001";
const stid = "6f1c2c1e-0000-4000-8000-0000000000aa";
const student: StudentRow = { id: stid, first_name: "Jayden", last_initial: "R", class_period: "3", created_at: "2026-10-14T15:00:00.000Z" };
const session: SessionRow = {
  id: sid,
  student_id: stid,
  is_test: false,
  machine_order: ["savings", "sale", "jersey"],
  order_assignment: "random",
  reveal_condition: "reveal",
  reveal_assignment: "random",
  app_version: "0.1.0+test",
  config_version: "abc",
  started_at: "2026-10-14T15:00:00.000Z",
  ended_at: null,
  current_step: "setup",
  current_machine: null,
  user_agent: null,
  screen_width: 1366,
  screen_height: 768,
  viewport_width: 1366,
  viewport_height: 657,
};
const ev = (seq: number, over: Partial<EventRow> = {}): EventRow => ({
  session_id: sid,
  seq,
  client_ts: "2026-10-14T15:00:01.000Z",
  server_ts: "2026-10-14T15:00:02.000Z",
  step: "machine",
  machine: "savings",
  event_type: "input_submit",
  payload: {},
  ...over,
});

describe("file store", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "bh-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("keeps names in students and only the id in sessions", async () => {
    const store = fileStore(dir);
    await store.createStudent(student);
    await store.createSession(session, student);
    const saved = await readFile(path.join(dir, "sessions", `${sid}.json`), "utf8");
    expect(saved).not.toContain("Jayden");
    expect((await store.getSession(sid))?.student.first_name).toBe("Jayden");
  });

  it("ignores resent events, even after a server restart", async () => {
    await fileStore(dir).insertEvents(sid, [ev(1), ev(2)]);
    const restarted = fileStore(dir);
    await Promise.all([restarted.insertEvents(sid, [ev(2), ev(3)]), restarted.insertEvents(sid, [ev(3), ev(4)])]);
    const lines = (await readFile(path.join(dir, "events", `${sid}.jsonl`), "utf8")).trim().split("\n");
    expect(lines.map((l) => JSON.parse(l).seq)).toEqual([1, 2, 3, 4]);
  });

  it("finds today's unfinished session by name and period, ignoring case", async () => {
    const store = fileStore(dir);
    await store.createStudent(student);
    await store.createSession(session, student);
    const since = "2026-10-14T05:00:00.000Z";
    expect(await store.findResumable({ firstName: "jayden", lastInitial: "r" }, "3", since)).toEqual({ sessionId: sid, startedAt: session.started_at });
    expect(await store.findResumable({ firstName: "Jayden", lastInitial: "R" }, "4", since)).toBeNull();
    expect(await store.findResumable({ firstName: "Jayden", lastInitial: "R" }, "3", "2026-10-15T05:00:00.000Z")).toBeNull();
    await store.markEnded(sid, "2026-10-14T15:10:00.000Z");
    expect(await store.findResumable({ firstName: "Jayden", lastInitial: "R" }, "3", since)).toBeNull();
  });

  it("tracks the current step and machine for the facilitator view", async () => {
    const store = fileStore(dir);
    await store.createStudent(student);
    await store.createSession(session, student);
    await store.setPosition(sid, "machine", "sale");
    expect((await store.getSession(sid))?.session).toMatchObject({ current_step: "machine", current_machine: "sale" });
  });

  it("rebuilds progress from step_enter and counted busted events", async () => {
    const store = fileStore(dir);
    await store.insertEvents(sid, [
      ev(1, { step: "machine", event_type: "step_enter", payload: { machine_index: 0 } }),
      ev(2, { event_type: "busted", payload: { verdict: "real", counted: true, bug_kind: "zero", inputs: { slices: "8", friends: "0" } } }),
      ev(3, { event_type: "busted", payload: { verdict: "real", counted: false, bug_kind: "zero" } }),
      ev(4, { event_type: "busted", payload: { verdict: "false_alarm", counted: false } }),
      ev(5, { step: "machine", machine: "sale", event_type: "step_enter", payload: { machine_index: 1 } }),
      ev(6, { step: "tutorial", machine: "allowance", event_type: "busted", payload: { verdict: "real", counted: true, bug_kind: "wrong_type" } }),
    ]);
    expect(progressFrom(await store.progressEvents(sid))).toEqual({
      step: "machine",
      machineIndex: 1,
      busted: [{ machine: "savings", kind: "zero", inputs: { slices: "8", friends: "0" } }],
    });
  });

  it("refuses ids that could escape the data folder", async () => {
    await expect(fileStore(dir).insertEvents("../../etc", [ev(1)])).rejects.toThrow();
  });
});

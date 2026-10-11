import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileStore, type EventRow, type SessionRow } from "@/lib/server/storage";

const id = "6f1c2c1e-0000-4000-8000-000000000001";
const session: SessionRow = {
  id,
  first_name: "TEST Ana",
  last_initial: "S",
  is_test: true,
  form: "A",
  condition: "ai_checker",
  form_assignment: "url",
  condition_assignment: "random",
  app_version: "0.1.0+test",
  config_version: "abc",
  started_at: "2026-10-11T15:00:00.000Z",
  ended_at: null,
  hunt_capped: false,
  user_agent: null,
  screen_width: 1366,
  screen_height: 768,
  viewport_width: 1366,
  viewport_height: 657,
};
const ev = (seq: number, type = "step_enter"): EventRow => ({
  session_id: id,
  seq,
  client_ts: "2026-10-11T15:00:01.000Z",
  server_ts: "2026-10-11T15:00:02.000Z",
  step: "meet",
  event_type: type,
  payload: {},
});

describe("file store", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "bh-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes a session file and an events file", async () => {
    const store = fileStore(dir);
    await store.createSession(session);
    await store.insertEvents(id, [ev(1), ev(2)]);
    const saved = JSON.parse(await readFile(path.join(dir, "sessions", `${id}.json`), "utf8"));
    expect(saved.first_name).toBe("TEST Ana");
    const lines = (await readFile(path.join(dir, "events", `${id}.jsonl`), "utf8")).trim().split("\n");
    expect(lines.map((l) => JSON.parse(l).seq)).toEqual([1, 2]);
  });

  it("ignores resent events, even after a server restart", async () => {
    await fileStore(dir).insertEvents(id, [ev(1), ev(2)]);
    const restarted = fileStore(dir);
    await Promise.all([restarted.insertEvents(id, [ev(2), ev(3)]), restarted.insertEvents(id, [ev(3), ev(4)])]);
    const lines = (await readFile(path.join(dir, "events", `${id}.jsonl`), "utf8")).trim().split("\n");
    expect(lines.map((l) => JSON.parse(l).seq)).toEqual([1, 2, 3, 4]);
  });

  it("records the end time once and the hunt cap", async () => {
    const store = fileStore(dir);
    await store.createSession(session);
    await store.markEnded(id, "2026-10-11T15:10:00.000Z");
    await store.markEnded(id, "2026-10-11T15:20:00.000Z");
    await store.markHuntCapped(id);
    const saved = JSON.parse(await readFile(path.join(dir, "sessions", `${id}.json`), "utf8"));
    expect(saved.ended_at).toBe("2026-10-11T15:10:00.000Z");
    expect(saved.hunt_capped).toBe(true);
  });

  it("refuses ids that could escape the data folder", async () => {
    await expect(fileStore(dir).insertEvents("../../etc", [ev(1)])).rejects.toThrow();
  });
});

import "server-only";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { serviceClient } from "./supabase";

/**
 * Where research data goes. Chosen by DATA_STORE, or automatically:
 *   - "supabase" when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
 *   - "file" when running on a machine with a disk (npm run dev / start)
 *   - "none" on Vercel without Supabase: the game still plays, but events
 *     stay queued on the student's device until a store is configured.
 */

export interface SessionRow {
  id: string;
  first_name: string;
  last_initial: string;
  is_test: boolean;
  form: string;
  condition: string;
  form_assignment: string;
  condition_assignment: string;
  app_version: string;
  config_version: string;
  started_at: string;
  ended_at: string | null;
  hunt_capped: boolean;
  user_agent: string | null;
  screen_width: number | null;
  screen_height: number | null;
  viewport_width: number | null;
  viewport_height: number | null;
}

export interface EventRow {
  session_id: string;
  seq: number;
  client_ts: string;
  server_ts: string;
  step: string;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface DataStore {
  kind: "supabase" | "file" | "none";
  createSession(row: SessionRow): Promise<void>;
  /** Must ignore events already stored (same session_id + seq). */
  insertEvents(sessionId: string, rows: EventRow[]): Promise<void>;
  markEnded(sessionId: string, endedAt: string): Promise<void>;
  markHuntCapped(sessionId: string): Promise<void>;
}

// ---------------------------------------------------------------- supabase

function supabaseStore(): DataStore | null {
  const db = serviceClient();
  if (!db) return null;
  return {
    kind: "supabase",
    async createSession(row) {
      const { error } = await db.from("sessions").insert(row);
      if (error) throw new Error(`session insert: ${error.code} ${error.message}`);
    },
    async insertEvents(_sessionId, rows) {
      const { error } = await db.from("events").upsert(rows, { onConflict: "session_id,seq", ignoreDuplicates: true });
      if (error) throw new Error(`events insert: ${error.code} ${error.message}`);
    },
    async markEnded(sessionId, endedAt) {
      await db.from("sessions").update({ ended_at: endedAt }).eq("id", sessionId).is("ended_at", null);
    },
    async markHuntCapped(sessionId) {
      await db.from("sessions").update({ hunt_capped: true }).eq("id", sessionId);
    },
  };
}

// -------------------------------------------------------------------- file

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Default data folder: outside OneDrive, because the files hold students' names. */
export function defaultLogDir(): string {
  return path.join(os.homedir(), "bughunters-data");
}

/**
 * One JSON file per session (sessions/<id>.json) and one JSON-lines file of
 * events per session (events/<id>.jsonl). Same columns as the Supabase
 * tables, so the two can be merged later.
 */
export function fileStore(dir: string = process.env.LOG_DIR || defaultLogDir()): DataStore {
  const seen = new Map<string, Set<number>>();
  const locks = new Map<string, Promise<unknown>>();

  function safeId(id: string): string {
    if (!UUID.test(id)) throw new Error("bad session id");
    return id;
  }
  const sessionPath = (id: string) => path.join(dir, "sessions", `${safeId(id)}.json`);
  const eventsPath = (id: string) => path.join(dir, "events", `${safeId(id)}.jsonl`);

  // Writes for one session run one at a time so duplicate checks hold.
  function serial<T>(id: string, task: () => Promise<T>): Promise<T> {
    const run = (locks.get(id) ?? Promise.resolve()).then(task, task);
    locks.set(id, run.catch(() => {}));
    return run;
  }

  async function seqsFor(id: string): Promise<Set<number>> {
    let set = seen.get(id);
    if (set) return set;
    set = new Set();
    try {
      for (const line of (await readFile(eventsPath(id), "utf8")).split("\n")) {
        if (line.trim()) set.add((JSON.parse(line) as EventRow).seq);
      }
    } catch {}
    seen.set(id, set);
    return set;
  }

  async function updateSession(id: string, change: (row: SessionRow) => SessionRow): Promise<void> {
    await serial(id, async () => {
      const row = JSON.parse(await readFile(sessionPath(id), "utf8")) as SessionRow;
      await writeFile(sessionPath(id), JSON.stringify(change(row), null, 2));
    });
  }

  return {
    kind: "file",
    async createSession(row) {
      await mkdir(path.join(dir, "sessions"), { recursive: true });
      await writeFile(sessionPath(row.id), JSON.stringify(row, null, 2), { flag: "wx" });
    },
    async insertEvents(sessionId, rows) {
      await serial(sessionId, async () => {
        const seqs = await seqsFor(sessionId);
        const fresh = rows.filter((r) => !seqs.has(r.seq));
        if (!fresh.length) return;
        await mkdir(path.join(dir, "events"), { recursive: true });
        await appendFile(eventsPath(sessionId), fresh.map((r) => JSON.stringify(r) + "\n").join(""));
        for (const r of fresh) seqs.add(r.seq);
      });
    },
    async markEnded(sessionId, endedAt) {
      await updateSession(sessionId, (row) => (row.ended_at ? row : { ...row, ended_at: endedAt }));
    },
    async markHuntCapped(sessionId) {
      await updateSession(sessionId, (row) => ({ ...row, hunt_capped: true }));
    },
  };
}

// -------------------------------------------------------------------- none

const noStore: DataStore = {
  kind: "none",
  async createSession() {},
  async insertEvents() {
    throw new Error("no data store configured");
  },
  async markEnded() {},
  async markHuntCapped() {},
};

// ------------------------------------------------------------------ choose

let chosen: DataStore | null = null;

export function dataStore(): DataStore {
  if (chosen) return chosen;
  const wanted = process.env.DATA_STORE?.trim().toLowerCase();
  if (wanted === "supabase") chosen = supabaseStore() ?? noStore;
  else if (wanted === "file") chosen = fileStore();
  else if (wanted === "none") chosen = noStore;
  else chosen = supabaseStore() ?? (process.env.VERCEL ? noStore : fileStore());
  return chosen;
}

import "server-only";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StudentName } from "@/lib/identity";
import { sameName } from "@/lib/identity";
import type { BustedBug, Progress, Step } from "@/lib/types";
import type { Category, MachineId } from "@/machines/types";
import { serviceClient } from "./supabase";

/**
 * Where research data goes. Chosen by DATA_STORE, or automatically:
 *   - "supabase" when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
 *   - "file" on a machine with a disk (npm run dev / start)
 *   - "none" on Vercel without Supabase: the game still plays, but events
 *     stay queued on the student's device until a store is configured.
 *
 * Names live only in students; everything else refers to student_id.
 */

export interface StudentRow {
  id: string;
  first_name: string;
  last_initial: string;
  class_period: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  student_id: string;
  is_test: boolean;
  machine_order: MachineId[];
  order_assignment: "random" | "url";
  /** Missed-bug reveal after every app, or only once at the end. */
  reveal_condition: "reveal" | "end_only";
  reveal_assignment: "random" | "url";
  app_version: string;
  config_version: string;
  started_at: string;
  ended_at: string | null;
  /** Where the student is now, kept current from step_enter events (for the facilitator view). */
  current_step: string | null;
  current_machine: string | null;
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
  machine: string | null;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface DataStore {
  kind: "supabase" | "file" | "none";
  createStudent(row: StudentRow): Promise<void>;
  createSession(row: SessionRow): Promise<void>;
  /** Latest unfinished session today for this name and period, if any. */
  findResumable(name: StudentName, period: string, sinceIso: string): Promise<{ sessionId: string; startedAt: string } | null>;
  getSession(id: string): Promise<{ session: SessionRow; student: StudentRow } | null>;
  /** Must ignore events already stored (same session_id + seq). */
  insertEvents(sessionId: string, rows: EventRow[]): Promise<void>;
  markEnded(sessionId: string, endedAt: string): Promise<void>;
  setPosition(sessionId: string, step: string, machine: string | null): Promise<void>;
  /** step_enter and busted events, in order, for rebuilding progress. */
  progressEvents(sessionId: string): Promise<Pick<EventRow, "step" | "machine" | "event_type" | "payload">[]>;
}

/** Rebuilds where a student was from their own events. */
export function progressFrom(events: Pick<EventRow, "step" | "machine" | "event_type" | "payload">[]): Progress {
  let step: Step = "intake";
  let machineIndex = 0;
  const busted: BustedBug[] = [];
  for (const e of events) {
    if (e.event_type === "step_enter") {
      step = e.step as Step;
      if (typeof e.payload.machine_index === "number") machineIndex = e.payload.machine_index;
    }
    if (e.event_type === "busted" && e.payload.verdict === "real" && e.payload.counted === true && e.machine && e.step === "machine") {
      busted.push({ machine: e.machine as MachineId, kind: e.payload.bug_kind as Category, inputs: (e.payload.inputs ?? {}) as Record<string, string> });
    }
  }
  return { step, machineIndex, busted };
}

// ---------------------------------------------------------------- supabase

function supabaseStore(): DataStore | null {
  const db = serviceClient();
  if (!db) return null;
  const fail = (what: string, error: { code?: string; message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.code} ${error.message}`);
  };
  return {
    kind: "supabase",
    async createStudent(row) {
      fail("student insert", (await db.from("students").insert(row)).error);
    },
    async createSession(row) {
      fail("session insert", (await db.from("sessions").insert(row)).error);
    },
    async findResumable(name, period, sinceIso) {
      const { data, error } = await db
        .from("sessions")
        .select("id, started_at, students!inner(first_name, last_initial, class_period)")
        .eq("students.class_period", period)
        .ilike("students.first_name", name.firstName)
        .ilike("students.last_initial", name.lastInitial)
        .gte("started_at", sinceIso)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1);
      fail("resume lookup", error);
      return data?.[0] ? { sessionId: data[0].id, startedAt: data[0].started_at } : null;
    },
    async getSession(id) {
      const { data, error } = await db.from("sessions").select("*, students(*)").eq("id", id).maybeSingle();
      fail("session lookup", error);
      if (!data) return null;
      const { students, ...session } = data;
      return { session: session as SessionRow, student: students as StudentRow };
    },
    async insertEvents(_sessionId, rows) {
      fail("events insert", (await db.from("events").upsert(rows, { onConflict: "session_id,seq", ignoreDuplicates: true })).error);
    },
    async markEnded(sessionId, endedAt) {
      await db.from("sessions").update({ ended_at: endedAt }).eq("id", sessionId).is("ended_at", null);
    },
    async setPosition(sessionId, step, machine) {
      await db.from("sessions").update({ current_step: step, current_machine: machine }).eq("id", sessionId);
    },
    async progressEvents(sessionId) {
      const { data, error } = await db
        .from("events")
        .select("step, machine, event_type, payload")
        .eq("session_id", sessionId)
        .in("event_type", ["step_enter", "busted"])
        .order("seq");
      fail("progress lookup", error);
      return data ?? [];
    },
  };
}

// -------------------------------------------------------------------- file

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Default data folder: outside OneDrive, because students' names are in it.
 * "v2" keeps this game's data apart from the earlier test-card version.
 */
export function defaultLogDir(): string {
  return path.join(os.homedir(), "bughunters-data", "v2");
}

/**
 * students/<id>.json, sessions/<id>.json, events/<session id>.jsonl. Same
 * columns as the Supabase tables, so they can be loaded there later.
 */
export function fileStore(dir: string = process.env.LOG_DIR || defaultLogDir()): DataStore {
  const seen = new Map<string, Set<number>>();
  const locks = new Map<string, Promise<unknown>>();

  function safeId(id: string): string {
    if (!UUID.test(id)) throw new Error("bad id");
    return id;
  }
  const file = (kind: "students" | "sessions", id: string) => path.join(dir, kind, `${safeId(id)}.json`);
  const eventsPath = (id: string) => path.join(dir, "events", `${safeId(id)}.jsonl`);

  // Writes for one session run one at a time so duplicate checks hold.
  function serial<T>(id: string, task: () => Promise<T>): Promise<T> {
    const run = (locks.get(id) ?? Promise.resolve()).then(task, task);
    locks.set(id, run.catch(() => {}));
    return run;
  }

  async function readJson<T>(p: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(p, "utf8")) as T;
    } catch {
      return null;
    }
  }

  async function readAll<T>(kind: "students" | "sessions"): Promise<T[]> {
    let names: string[] = [];
    try {
      names = (await readdir(path.join(dir, kind))).filter((n) => n.endsWith(".json"));
    } catch {
      return [];
    }
    const rows = await Promise.all(names.map((n) => readJson<T>(path.join(dir, kind, n))));
    return rows.filter((r): r is Awaited<T> => r !== null) as T[];
  }

  async function readEvents(id: string): Promise<EventRow[]> {
    try {
      return (await readFile(eventsPath(id), "utf8"))
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as EventRow)
        .sort((a, b) => a.seq - b.seq);
    } catch {
      return [];
    }
  }

  async function seqsFor(id: string): Promise<Set<number>> {
    let set = seen.get(id);
    if (!set) {
      set = new Set((await readEvents(id)).map((e) => e.seq));
      seen.set(id, set);
    }
    return set;
  }

  async function updateSession(id: string, change: (row: SessionRow) => SessionRow): Promise<void> {
    await serial(`session:${id}`, async () => {
      const row = await readJson<SessionRow>(file("sessions", id));
      if (row) await writeFile(file("sessions", id), JSON.stringify(change(row), null, 2));
    });
  }

  return {
    kind: "file",
    async createStudent(row) {
      await mkdir(path.join(dir, "students"), { recursive: true });
      await writeFile(file("students", row.id), JSON.stringify(row, null, 2), { flag: "wx" });
    },
    async createSession(row) {
      await mkdir(path.join(dir, "sessions"), { recursive: true });
      await writeFile(file("sessions", row.id), JSON.stringify(row, null, 2), { flag: "wx" });
    },
    async findResumable(name, period, sinceIso) {
      const students = (await readAll<StudentRow>("students")).filter(
        (s) => s.class_period === period && sameName({ firstName: s.first_name, lastInitial: s.last_initial }, name),
      );
      if (!students.length) return null;
      const ids = new Set(students.map((s) => s.id));
      const sessions = (await readAll<SessionRow>("sessions"))
        .filter((s) => ids.has(s.student_id) && s.started_at >= sinceIso && !s.ended_at)
        .sort((a, b) => b.started_at.localeCompare(a.started_at));
      return sessions[0] ? { sessionId: sessions[0].id, startedAt: sessions[0].started_at } : null;
    },
    async getSession(id) {
      const session = await readJson<SessionRow>(file("sessions", id));
      const student = session ? await readJson<StudentRow>(file("students", session.student_id)) : null;
      return session && student ? { session, student } : null;
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
    async setPosition(sessionId, step, machine) {
      await updateSession(sessionId, (row) => ({ ...row, current_step: step, current_machine: machine }));
    },
    async progressEvents(sessionId) {
      return (await readEvents(sessionId)).filter((e) => e.event_type === "step_enter" || e.event_type === "busted");
    },
  };
}

// -------------------------------------------------------------------- none

const noStore: DataStore = {
  kind: "none",
  async createStudent() {},
  async createSession() {},
  async findResumable() {
    return null;
  },
  async getSession() {
    return null;
  },
  async insertEvents() {
    throw new Error("no data store configured");
  },
  async markEnded() {},
  async setPosition() {},
  async progressEvents() {
    return [];
  },
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

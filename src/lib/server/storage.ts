import "server-only";
import { get as blobGet, head as blobHead, list as blobList, put as blobPut } from "@vercel/blob";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StudentName } from "@/lib/identity";
import { sameName } from "@/lib/identity";
import type { BustedBug, Progress, Step } from "@/lib/types";
import type { Category, MachineId } from "@/machines/types";
import { encryptName, nameKey, publicKeyPem } from "./names";
import { serviceClient } from "./supabase";

/**
 * Where research data goes. Chosen by DATA_STORE, or automatically:
 *   - "supabase" when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
 *   - "blob" when BLOB_READ_WRITE_TOKEN and NAMES_PUBLIC_KEY are set: private
 *     Vercel Blob storage, names encrypted; npm run pull brings it home
 *   - "file" on a machine with a disk (npm run dev / start)
 *   - "none" on Vercel without a store: the game still plays, but events
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
  /** Blob store only: keyed fingerprint of name + period (names are encrypted). */
  name_key?: string;
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

/**
 * One leaderboard row per session: a nickname (never a name), bugs busted
 * in the three apps plus code question points, and its class and day.
 */
export interface ScoreRow {
  session_id: string;
  nickname: string;
  /** Bugs busted in the three apps. */
  bugs: number;
  /** Code question points (1 per part right). Absent on older rows. */
  code_points?: number;
  /** The leaderboard score: bugs + code points. Absent on older rows (use bugs). */
  points?: number;
  class_period: string;
  /** "2026-10-13" in the school's time zone. */
  day: string;
  is_test: boolean;
  updated_at: string;
}

export interface DataStore {
  kind: "supabase" | "blob" | "file" | "none";
  createStudent(row: StudentRow): Promise<void>;
  /** `student` is the row just created for it (the blob store indexes its name). */
  createSession(row: SessionRow, student: StudentRow): Promise<void>;
  /** Is this stored student the person with this name and period? */
  isStudent(student: StudentRow, name: StudentName, period: string): boolean;
  /** Latest unfinished session today for this name and period, if any. */
  findResumable(name: StudentName, period: string, sinceIso: string): Promise<{ sessionId: string; startedAt: string } | null>;
  getSession(id: string): Promise<{ session: SessionRow; student: StudentRow } | null>;
  /** Must ignore events already stored (same session_id + seq). */
  insertEvents(sessionId: string, rows: EventRow[]): Promise<void>;
  markEnded(sessionId: string, endedAt: string): Promise<void>;
  setPosition(sessionId: string, step: string, machine: string | null): Promise<void>;
  /** step_enter and busted events, in order, for rebuilding progress. */
  progressEvents(sessionId: string): Promise<Pick<EventRow, "step" | "machine" | "event_type" | "payload">[]>;
  /** Leaderboard: saves this session's score (the latest one wins). */
  putScore(row: ScoreRow): Promise<void>;
  /** Leaderboard: every score on one day, all class periods together. */
  listScores(day: string): Promise<ScoreRow[]>;
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
    isStudent: (st, name, period) => st.class_period === period && sameName({ firstName: st.first_name, lastInitial: st.last_initial }, name),
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
    async putScore(row) {
      fail("score upsert", (await db.from("scores").upsert(row, { onConflict: "session_id" })).error);
    },
    async listScores(day) {
      const { data, error } = await db.from("scores").select("*").eq("day", day);
      fail("scores lookup", error);
      return (data ?? []) as ScoreRow[];
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
    isStudent: (st, name, period) => st.class_period === period && sameName({ firstName: st.first_name, lastInitial: st.last_initial }, name),
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
    async putScore(row) {
      const d = scoreDir(dir, row.day);
      await mkdir(d, { recursive: true });
      await writeFile(path.join(d, `${safeId(row.session_id)}.json`), JSON.stringify(row, null, 2));
    },
    async listScores(day) {
      const d = scoreDir(dir, day);
      let names: string[] = [];
      try {
        names = (await readdir(d)).filter((n) => n.endsWith(".json"));
      } catch {
        return [];
      }
      return (await Promise.all(names.map((n) => readJson<ScoreRow>(path.join(d, n))))).filter((r): r is ScoreRow => r !== null);
    },
  };
}

/** scores/<day>/: the day is checked so it can't leave the folder. */
function scoreDir(dir: string, day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("bad score key");
  return path.join(dir, "scores", day);
}

// -------------------------------------------------------------------- blob

/**
 * Private Vercel Blob storage. Write-once JSON files (no read-modify-write,
 * so concurrent requests can't clobber each other):
 *   students/<id>.json                      names encrypted, plus name_key
 *   sessions/<id>.json                      the session row
 *   index/<name_key>/<started_at>__<id>.json  for "Keep going?" by name
 *   ended/<id>.json                         written at session_end
 *   events/<id>/<first>-<last>.json         one file per batch; a resent
 *                                           batch overwrites itself
 * npm run pull merges it all into the local file store, de-duplicated.
 */
function blobStore(): DataStore | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const pem = publicKeyPem();
  // Never store names in the cloud unencrypted: no key, no blob store.
  if (!token || !pem || !process.env.SESSION_SECRET) return null;
  const opts = { access: "private" as const, token, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" };
  const putJson = (pathname: string, body: unknown) => blobPut(pathname, JSON.stringify(body), opts);
  const getJson = async <T>(pathname: string): Promise<T | null> => {
    const r = await blobGet(pathname, { access: "private", token }).catch(() => null);
    return r && r.statusCode === 200 ? ((await new Response(r.stream).json()) as T) : null;
  };
  const listAll = async (prefix: string) => {
    const out: { pathname: string }[] = [];
    let cursor: string | undefined;
    do {
      const page = await blobList({ prefix, token, cursor });
      out.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return out;
  };
  const exists = async (pathname: string) => !!(await blobHead(pathname, { token }).catch(() => null));

  return {
    kind: "blob",
    async createStudent(row) {
      const name = { firstName: row.first_name, lastInitial: row.last_initial };
      await putJson(`students/${row.id}.json`, {
        id: row.id,
        name_enc: encryptName(name, pem),
        name_key: nameKey(name, row.class_period),
        class_period: row.class_period,
        created_at: row.created_at,
      });
    },
    async createSession(row, student) {
      await putJson(`sessions/${row.id}.json`, row);
      const key = nameKey({ firstName: student.first_name, lastInitial: student.last_initial }, student.class_period);
      await putJson(`index/${key}/${row.started_at.replace(/:/g, "-")}__${row.id}.json`, {});
    },
    isStudent: (st, name, period) => st.class_period === period && st.name_key === nameKey(name, period),
    async findResumable(name, period, sinceIso) {
      const since = sinceIso.replace(/:/g, "-");
      const hits = (await listAll(`index/${nameKey(name, period)}/`))
        .map((b) => b.pathname.split("/").pop()!.replace(/\.json$/, "").split("__"))
        .filter(([started]) => started >= since)
        .sort((a, b) => b[0].localeCompare(a[0]));
      for (const [started, id] of hits) {
        if (!(await exists(`ended/${id}.json`))) return { sessionId: id, startedAt: started };
      }
      return null;
    },
    async getSession(id) {
      if (!UUID.test(id)) return null;
      const session = await getJson<SessionRow>(`sessions/${id}.json`);
      if (!session) return null;
      const student = await getJson<StudentRow>(`students/${session.student_id}.json`);
      if (!student) return null;
      const ended = await getJson<{ ended_at: string }>(`ended/${id}.json`);
      return { session: { ...session, ended_at: ended?.ended_at ?? null }, student: { ...student, first_name: "", last_initial: "" } };
    },
    async insertEvents(sessionId, rows) {
      if (!UUID.test(sessionId)) throw new Error("bad id");
      const seqs = rows.map((r) => r.seq);
      const pad = (n: number) => String(n).padStart(6, "0");
      await putJson(`events/${sessionId}/${pad(Math.min(...seqs))}-${pad(Math.max(...seqs))}.json`, rows);
    },
    async markEnded(sessionId, endedAt) {
      if (!(await exists(`ended/${sessionId}.json`))) await putJson(`ended/${sessionId}.json`, { ended_at: endedAt });
    },
    // The facilitator view needs Supabase (staff login), so positions aren't kept here.
    async setPosition() {},
    async progressEvents(sessionId) {
      const files = await listAll(`events/${sessionId}/`);
      const rows = (await Promise.all(files.map((f) => getJson<EventRow[]>(f.pathname)))).flat().filter((r): r is EventRow => !!r);
      const bySeq = new Map(rows.map((r) => [r.seq, r]));
      return [...bySeq.values()].sort((a, b) => a.seq - b.seq).filter((e) => e.event_type === "step_enter" || e.event_type === "busted");
    },
    async putScore(row) {
      if (!UUID.test(row.session_id)) throw new Error("bad id");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.day)) throw new Error("bad score key");
      await putJson(`scores/${row.day}/${row.session_id}.json`, row);
    },
    async listScores(day) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("bad score key");
      const files = await listAll(`scores/${day}/`);
      return (await Promise.all(files.map((f) => getJson<ScoreRow>(f.pathname)))).filter((r): r is ScoreRow => !!r);
    },
  };
}

// -------------------------------------------------------------------- none

const noStore: DataStore = {
  kind: "none",
  async createStudent() {},
  async createSession() {},
  isStudent: () => false,
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
  async putScore() {},
  async listScores() {
    return [];
  },
};

// ------------------------------------------------------------------ choose

let chosen: DataStore | null = null;

export function dataStore(): DataStore {
  if (chosen) return chosen;
  const wanted = process.env.DATA_STORE?.trim().toLowerCase();
  if (wanted === "supabase") chosen = supabaseStore() ?? noStore;
  else if (wanted === "blob") chosen = blobStore() ?? noStore;
  else if (wanted === "file") chosen = fileStore();
  else if (wanted === "none") chosen = noStore;
  else chosen = supabaseStore() ?? blobStore() ?? (process.env.VERCEL ? noStore : fileStore());
  return chosen;
}

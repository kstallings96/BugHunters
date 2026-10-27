/**
 * Brings study data home to this laptop's data folder (outside OneDrive),
 * decrypting names with the private key from npm run keys.
 *
 *   npm run pull                          from the cloud (Vercel Blob), new files only
 *   npm run pull -- --all                 from the cloud, every file again
 *   npm run pull -- --backup a.json b.json  from Chromebook backup files
 *
 * Both can be run any number of times, in any order: events are merged by
 * (session, event number), so overlapping copies never double up. Nothing
 * is ever deleted, here or in the cloud. Afterwards: npm run export.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { get, list } from "@vercel/blob";
import { isTestName } from "@/lib/identity";
import { decryptBackupRecord, decryptName, type BackupRecord } from "@/lib/researcher/decrypt";
import { defaultLogDir, type EventRow, type SessionRow, type StudentRow } from "@/lib/server/storage";

const dir = process.env.LOG_DIR || defaultLogDir();
const keyPath = process.env.NAMES_PRIVATE_KEY_PATH || path.join(os.homedir(), "bughunters-data", "keys", "names-private.pem");

async function writeJson(kind: "students" | "sessions", row: StudentRow | SessionRow) {
  await mkdir(path.join(dir, kind), { recursive: true });
  await writeFile(path.join(dir, kind, `${row.id}.json`), JSON.stringify(row, null, 2));
}

/** Adds events to a session's log, keeping the first copy of each event number. Returns how many were new. */
async function mergeEvents(sessionId: string, incoming: EventRow[]): Promise<number> {
  const p = path.join(dir, "events", `${sessionId}.jsonl`);
  const existing: EventRow[] = existsSync(p)
    ? (await readFile(p, "utf8"))
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l))
    : [];
  const bySeq = new Map(existing.map((e) => [e.seq, e]));
  let added = 0;
  for (const e of incoming) {
    if (!bySeq.has(e.seq)) {
      bySeq.set(e.seq, e);
      added++;
    }
  }
  if (!added) return 0;
  await mkdir(path.join(dir, "events"), { recursive: true });
  const rows = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  await writeFile(p, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  return added;
}

/** Runs async work a few at a time. */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

/**
 * Every file read from the cloud is a paid storage read, and cloud files
 * never change once written, so the names of files already brought home are
 * kept here and skipped next time. --all reads everything again.
 */
const pulledPath = path.join(dir, "pulled-files.json");

async function fromCloud(pem: string, all: boolean) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Set BLOB_READ_WRITE_TOKEN in .env.local (vercel env pull) to pull from the cloud.");
  const blobs: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ token, cursor });
    blobs.push(...page.blobs.map((b) => b.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const pulled = new Set<string>(!all && existsSync(pulledPath) ? JSON.parse(await readFile(pulledPath, "utf8")) : []);
  const fresh = blobs.filter((b) => !pulled.has(b));
  const fetchJson = async (pathname: string) => {
    const r = await get(pathname, { access: "private", token });
    if (!r || r.statusCode !== 200) return null;
    const json = await new Response(r.stream).json();
    pulled.add(pathname);
    return json;
  };

  // A new session needs its end time even if that file came home before.
  const sessionPaths = fresh.filter((b) => b.startsWith("sessions/"));
  const endedPaths = new Set(fresh.filter((b) => b.startsWith("ended/")));
  for (const p of sessionPaths) if (blobs.includes(`ended/${p.slice(9)}`)) endedPaths.add(`ended/${p.slice(9)}`);
  const ended = new Map<string, string>();
  for (const p of endedPaths) {
    const e = await fetchJson(p);
    ended.set(p.slice(6, -5), e?.ended_at);
  }
  let students = 0;
  await pool(fresh.filter((b) => b.startsWith("students/")), 12, async (p) => {
    const s = await fetchJson(p);
    const name = decryptName(s.name_enc, pem);
    const row: StudentRow = { id: s.id, ...name, class_period: s.class_period, created_at: s.created_at };
    await writeJson("students", row);
    students++;
  });
  await pool(sessionPaths, 12, async (p) => {
    const s = (await fetchJson(p)) as SessionRow;
    await writeJson("sessions", { ...s, ended_at: ended.get(s.id) ?? s.ended_at ?? null });
  });
  // Sessions brought home earlier that have finished since.
  const newSessions = new Set(sessionPaths.map((p) => p.slice(9, -5)));
  for (const [id, endedAt] of ended) {
    const p = path.join(dir, "sessions", `${id}.json`);
    if (newSessions.has(id) || !existsSync(p)) continue;
    const s = JSON.parse(await readFile(p, "utf8")) as SessionRow;
    if (!s.ended_at) await writeJson("sessions", { ...s, ended_at: endedAt });
  }
  const eventFiles = fresh.filter((b) => b.startsWith("events/"));
  const bySession = new Map<string, string[]>();
  for (const p of eventFiles) {
    const sid = p.split("/")[1];
    bySession.set(sid, [...(bySession.get(sid) ?? []), p]);
  }
  let added = 0;
  for (const [sid, files] of bySession) {
    const rows = (await pool(files, 12, fetchJson)).flat() as EventRow[];
    added += await mergeEvents(sid, rows);
  }
  await mkdir(dir, { recursive: true });
  await writeFile(pulledPath, JSON.stringify([...pulled]));
  console.log(
    `cloud: ${students} new students, ${sessionPaths.length} new sessions, ${added} new events (${eventFiles.length} new batch files; ${blobs.length - fresh.length} files already here were skipped)`,
  );
}

/** A stable UUID-shaped id from text (for sessions only known from a device backup). */
function uuidFrom(text: string): string {
  const h = createHash("sha256").update(text).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function fromBackups(files: string[], pem: string) {
  let added = 0;
  let created = 0;
  for (const f of files) {
    const doc = JSON.parse(await readFile(f, "utf8"));
    for (const r of doc.records as BackupRecord[]) {
      const { meta, events } = decryptBackupRecord(r, pem);
      const sessionPath = path.join(dir, "sessions", `${meta.session_id}.json`);
      if (!existsSync(sessionPath)) {
        // Known only from this device: rebuild the session from the backup.
        const studentId = uuidFrom(`backup-student:${meta.session_id}`);
        const first = [...events].sort((a, b) => a.seq - b.seq)[0];
        const end = events.find((e) => e.event_type === "session_end");
        const student: StudentRow = { id: studentId, first_name: meta.first_name, last_initial: meta.last_initial, class_period: meta.class_period, created_at: first?.client_ts ?? r.saved_at };
        await writeJson("students", student);
        await writeJson("sessions", {
          id: meta.session_id,
          student_id: studentId,
          is_test: isTestName(meta.first_name),
          machine_order: meta.machine_order,
          order_assignment: "unknown",
          reveal_condition: meta.reveal_condition,
          reveal_assignment: "unknown",
          app_version: "unknown (device backup)",
          config_version: "unknown",
          started_at: first?.client_ts ?? r.saved_at,
          ended_at: end?.client_ts ?? null,
          current_step: null,
          current_machine: null,
          user_agent: null,
          screen_width: null,
          screen_height: null,
          viewport_width: null,
          viewport_height: null,
          source: "device_backup",
        } as unknown as SessionRow);
        created++;
      }
      added += await mergeEvents(
        meta.session_id,
        events.map((e) => ({ session_id: e.sid, seq: e.seq, client_ts: e.client_ts, server_ts: "", step: e.step, machine: e.machine ?? null, event_type: e.event_type, payload: e.payload })),
      );
    }
  }
  console.log(`backups: ${files.length} file(s), ${created} session(s) only on devices, ${added} new events`);
}

async function main() {
  if (!existsSync(keyPath)) throw new Error(`No private key at ${keyPath}. It was made by npm run keys on the researcher's laptop.`);
  const pem = await readFile(keyPath, "utf8");
  const i = process.argv.indexOf("--backup");
  if (i >= 0) await fromBackups(process.argv.slice(i + 1), pem);
  else await fromCloud(pem, process.argv.includes("--all"));
  console.log(`Saved to ${dir}. Next: npm run export`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

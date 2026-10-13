/**
 * Exports the local data folder to CSV: sessions, events, metrics.
 *
 *   npm run export              names left out (class period is kept, for joining)
 *   npm run export -- --names   staff only: adds first name and last initial,
 *                               to join with the outside pre/post surveys
 *
 * Writes to <data folder>/exports/<timestamp>/, which is outside OneDrive and
 * outside the repo. Every row carries reveal_condition and machine_order.
 * (Reads the local file store; the Supabase version comes with stage 1.)
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { computeMetrics, type MetricEvent } from "@/lib/metrics";
import { defaultLogDir, type SessionRow, type StudentRow } from "@/lib/server/storage";

const withNames = process.argv.includes("--names");
const dir = process.env.LOG_DIR || defaultLogDir();

async function readAll<T>(kind: string): Promise<T[]> {
  try {
    const files = (await readdir(path.join(dir, kind))).filter((f) => f.endsWith(".json"));
    return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, kind, f), "utf8")) as T));
  } catch {
    return [];
  }
}

async function eventsOf(id: string): Promise<(MetricEvent & { server_ts: string })[]> {
  try {
    const text = await readFile(path.join(dir, "events", `${id}.jsonl`), "utf8");
    return text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
      .sort((a, b) => a.seq - b.seq);
  } catch {
    return [];
  }
}

function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}

async function main() {
  const students = new Map((await readAll<StudentRow>("students")).map((s) => [s.id, s]));
  const sessions = (await readAll<SessionRow>("sessions")).filter((s) => Array.isArray(s.machine_order) && s.reveal_condition);
  sessions.sort((a, b) => a.started_at.localeCompare(b.started_at));

  const who = (s: SessionRow) => {
    const st = students.get(s.student_id);
    return withNames
      ? { first_name: st?.first_name ?? "", last_initial: st?.last_initial ?? "", class_period: st?.class_period ?? "" }
      : { class_period: st?.class_period ?? "" };
  };

  const sessionRows: Record<string, unknown>[] = [];
  const eventRows: Record<string, unknown>[] = [];
  const metricRows: Record<string, unknown>[] = [];
  for (const s of sessions) {
    const ev = await eventsOf(s.id);
    const shared = { session_id: s.id, is_test: s.is_test, reveal_condition: s.reveal_condition, machine_order: s.machine_order.join(">") };
    sessionRows.push({
      ...shared,
      student_id: s.student_id,
      ...who(s),
      order_assignment: s.order_assignment,
      reveal_assignment: s.reveal_assignment,
      app_version: s.app_version,
      config_version: s.config_version,
      started_at: s.started_at,
      ended_at: s.ended_at,
      user_agent: s.user_agent,
      screen: `${s.screen_width}x${s.screen_height}`,
      viewport: `${s.viewport_width}x${s.viewport_height}`,
      events: ev.length,
    });
    for (const e of ev) {
      eventRows.push({ ...shared, seq: e.seq, client_ts: e.client_ts, server_ts: e.server_ts, step: e.step, machine: e.machine, event_type: e.event_type, payload: e.payload });
    }
    for (const m of computeMetrics(s, ev)) metricRows.push({ ...m, student_id: s.student_id, ...who(s) });
  }

  const out = path.join(dir, "exports", new Date().toISOString().replace(/[:.]/g, "-") + (withNames ? "-with-names" : ""));
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, "sessions.csv"), csv(sessionRows));
  await writeFile(path.join(out, "events.csv"), csv(eventRows));
  await writeFile(path.join(out, "metrics.csv"), csv(metricRows));
  console.log(`${sessionRows.length} sessions, ${eventRows.length} events, ${metricRows.length} metric rows → ${out}${withNames ? "  (INCLUDES NAMES: staff only)" : ""}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

// Confirms data is arriving, without printing anything identifying.
// Reads the local data folder (Supabase support returns with stage 1).
// Usage: npm run check-data
import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const dir = process.env.LOG_DIR || path.join(os.homedir(), "bughunters-data", "v2");
console.log(`local files in ${dir}`);

async function readAll(kind) {
  try {
    const names = (await readdir(path.join(dir, kind))).filter((n) => n.endsWith(".json"));
    return Promise.all(names.map(async (n) => JSON.parse(await readFile(path.join(dir, kind, n), "utf8"))));
  } catch {
    return [];
  }
}

async function events(id) {
  try {
    const text = await readFile(path.join(dir, "events", `${id}.jsonl`), "utf8");
    return text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.seq - b.seq);
  } catch {
    return [];
  }
}

const students = await readAll("students");
const sessions = (await readAll("sessions")).sort((a, b) => b.started_at.localeCompare(a.started_at));
console.log(`students: ${students.length}   sessions: ${sessions.length} (${sessions.filter((s) => s.is_test).length} test)`);

for (const s of sessions.slice(0, 3)) {
  const ev = await events(s.id);
  const counts = {};
  for (const e of ev) counts[e.event_type] = (counts[e.event_type] ?? 0) + 1;
  console.log(
    `\n${s.id.slice(0, 8)}  test=${s.is_test}  order=${s.machine_order.join(">")} (${s.order_assignment})  now=${s.current_step}/${s.current_machine ?? "-"}  ended=${s.ended_at ? "yes" : "no"}  events=${ev.length}`,
  );
  console.log("  " + Object.entries(counts).map(([k, v]) => `${k}:${v}`).join("  "));
  for (const e of ev.filter((e) => e.event_type === "busted")) {
    console.log(`  busted on ${e.machine}: ${JSON.stringify(e.payload.inputs)} → ${e.payload.verdict}${e.payload.bug_kind ? ` (${e.payload.bug_kind})` : ""}`);
  }
}

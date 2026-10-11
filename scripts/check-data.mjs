// Confirms data is arriving, without printing anything identifying.
// Reads Supabase if its keys are set, otherwise the local data folder.
// Usage: npm run check-data
import { readdir, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const useSupabase =
  process.env.DATA_STORE === "supabase" ||
  (!process.env.DATA_STORE && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function show(s, events) {
  console.log(
    `\n${s.id.slice(0, 8)}  test=${s.is_test}  form=${s.form}(${s.form_assignment})  ${s.condition}(${s.condition_assignment})  ${s.app_version}  ended=${s.ended_at ? "yes" : "no"}`,
  );
  console.log("  " + events.map((e) => `${e.seq}:${e.step}/${e.event_type}`).join("  "));
}

if (!useSupabase) {
  const dir = process.env.LOG_DIR || path.join(os.homedir(), "bughunters-data");
  console.log(`local files in ${dir}`);
  let files = [];
  try {
    files = (await readdir(path.join(dir, "sessions"))).filter((f) => f.endsWith(".json"));
  } catch {
    console.log("no sessions yet");
    process.exit(0);
  }
  const sessions = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, "sessions", f), "utf8"))));
  sessions.sort((a, b) => b.started_at.localeCompare(a.started_at));
  let total = 0;
  const eventsBy = {};
  for (const s of sessions) {
    try {
      const text = await readFile(path.join(dir, "events", `${s.id}.jsonl`), "utf8");
      eventsBy[s.id] = text.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).sort((a, b) => a.seq - b.seq);
    } catch {
      eventsBy[s.id] = [];
    }
    total += eventsBy[s.id].length;
  }
  console.log(`sessions: ${sessions.length} (${sessions.filter((s) => s.is_test).length} test)   events: ${total}`);
  for (const s of sessions.slice(0, 3)) show(s, eventsBy[s.id]);
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const url = process.env.SUPABASE_URL;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { count: sessions } = await db.from("sessions").select("*", { count: "exact", head: true });
const { count: tests } = await db.from("sessions").select("*", { count: "exact", head: true }).eq("is_test", true);
const { count: events } = await db.from("events").select("*", { count: "exact", head: true });
console.log(`supabase\nsessions: ${sessions} (${tests} test)   events: ${events}`);

const { data: recent, error } = await db
  .from("sessions")
  .select("id, is_test, form, condition, form_assignment, condition_assignment, app_version, started_at, ended_at")
  .order("started_at", { ascending: false })
  .limit(3);
if (error) {
  console.error(error.message);
  process.exit(1);
}
for (const s of recent) {
  const { data: ev } = await db.from("events").select("seq, step, event_type").eq("session_id", s.id).order("seq");
  show(s, ev ?? []);
}

// RLS check: the anon key must see nothing.
const anonKey = process.env.SUPABASE_ANON_KEY;
if (anonKey) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const read = await anon.from("sessions").select("id").limit(1);
  const write = await anon.from("events").insert({ session_id: recent[0]?.id, seq: 999999, client_ts: new Date().toISOString(), step: "x", event_type: "x" });
  console.log(`\nanon read: ${read.error ? "blocked" : `ALLOWED (${read.data.length} rows)`}   anon write: ${write.error ? "blocked" : "ALLOWED"}`);
}

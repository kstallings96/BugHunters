// Confirms data is arriving in Supabase without printing anything identifying.
// Usage: npm run check-data
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const { count: sessions } = await db.from("sessions").select("*", { count: "exact", head: true });
const { count: tests } = await db.from("sessions").select("*", { count: "exact", head: true }).eq("is_test", true);
const { count: events } = await db.from("events").select("*", { count: "exact", head: true });
console.log(`sessions: ${sessions} (${tests} test)   events: ${events}`);

// Latest sessions by id prefix only, with their event types.
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
  console.log(
    `\n${s.id.slice(0, 8)}  test=${s.is_test}  form=${s.form}(${s.form_assignment})  ${s.condition}(${s.condition_assignment})  ${s.app_version}  ended=${s.ended_at ? "yes" : "no"}`,
  );
  console.log("  " + (ev ?? []).map((e) => `${e.seq}:${e.step}/${e.event_type}`).join("  "));
}

// RLS check: the anon key must see nothing.
const anonKey = process.env.SUPABASE_ANON_KEY;
if (anonKey) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const read = await anon.from("sessions").select("id").limit(1);
  const write = await anon.from("events").insert({ session_id: recent[0]?.id, seq: 999999, client_ts: new Date().toISOString(), step: "x", event_type: "x" });
  console.log(`\nanon read: ${read.error ? "blocked" : `ALLOWED (${read.data.length} rows)`}   anon write: ${write.error ? "blocked" : "ALLOWED"}`);
}

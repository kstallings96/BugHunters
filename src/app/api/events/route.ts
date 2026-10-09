import { parseBatch } from "@/lib/eventBatch";
import { serviceClient } from "@/lib/server/supabase";
import { verifyToken } from "@/lib/server/token";

/**
 * Receives a batch of events from the client queue. Also the target of the
 * page-hide sendBeacon, which is same-origin, so no CORS is involved.
 *
 * Status codes tell the client what to do with the batch:
 * 200 stored (duplicates included), 400 malformed (drop it), 401 bad token
 * (stop sending for that session), 5xx (keep it and retry later).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sessionId = verifyToken(body?.token);
  if (!sessionId) return Response.json({ error: "token" }, { status: 401 });
  const events = parseBatch(body?.events);
  if (!events) return Response.json({ error: "batch" }, { status: 400 });

  const db = serviceClient();
  if (!db) return Response.json({ error: "not_configured" }, { status: 503 });

  const rows = events.map((e) => ({
    session_id: sessionId,
    seq: e.seq,
    client_ts: e.client_ts,
    step: e.step,
    event_type: e.event_type,
    payload: e.payload,
  }));
  // A resent batch hits the (session_id, seq) unique key; ignoring those
  // rows makes every retry safe.
  const { error } = await db
    .from("events")
    .upsert(rows, { onConflict: "session_id,seq", ignoreDuplicates: true });
  if (error) {
    console.error("events insert failed", error.code, error.message);
    return Response.json({ error: "db" }, { status: 502 });
  }

  // Session-level columns derived from events, written only by the server.
  const end = events.find((e) => e.event_type === "session_end");
  if (end) {
    await db.from("sessions").update({ ended_at: end.client_ts }).eq("id", sessionId).is("ended_at", null);
  }
  if (events.some((e) => e.event_type === "done" && e.payload.capped === true)) {
    await db.from("sessions").update({ hunt_capped: true }).eq("id", sessionId);
  }

  return Response.json({ ok: true, stored: rows.length });
}

import { parseBatch } from "@/lib/eventBatch";
import { dataStore } from "@/lib/server/storage";
import { verifyToken } from "@/lib/server/token";

/**
 * Receives a batch of events from the client queue. Also the target of the
 * page-hide sendBeacon, which is same-origin, so no CORS is involved.
 *
 * Status codes tell the client what to do with the batch:
 * 200 stored (duplicates included), 400 malformed (drop it), 401 bad token
 * (stop sending for that session), 5xx (keep it on the device, retry later).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const sessionId = verifyToken(body?.token);
  if (!sessionId) return Response.json({ error: "token" }, { status: 401 });
  const events = parseBatch(body?.events);
  if (!events) return Response.json({ error: "batch" }, { status: 400 });

  const store = dataStore();
  if (store.kind === "none") return Response.json({ error: "not_configured" }, { status: 503 });

  const serverTs = new Date().toISOString();
  const rows = events.map((e) => ({
    session_id: sessionId,
    seq: e.seq,
    client_ts: e.client_ts,
    server_ts: serverTs,
    step: e.step,
    event_type: e.event_type,
    payload: e.payload,
  }));
  try {
    // A resent batch repeats (session_id, seq); the store ignores those
    // rows, which makes every retry safe.
    await store.insertEvents(sessionId, rows);

    // Session-level columns derived from events, written only by the server.
    const end = events.find((e) => e.event_type === "session_end");
    if (end) await store.markEnded(sessionId, end.client_ts);
    if (events.some((e) => e.event_type === "done" && e.payload.capped === true)) {
      await store.markHuntCapped(sessionId);
    }
  } catch (err) {
    console.error("events store failed", (err as Error).message);
    return Response.json({ error: "store" }, { status: 502 });
  }

  return Response.json({ ok: true, stored: rows.length });
}

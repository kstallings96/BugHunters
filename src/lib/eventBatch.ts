/**
 * Shape checks for event batches posted to /api/events. Pure, so it can be
 * unit-tested without a server.
 */

export interface IncomingEvent {
  seq: number;
  client_ts: string;
  step: string;
  machine: string | null;
  event_type: string;
  payload: Record<string, unknown>;
}

export const MAX_BATCH = 100;
/** Per-event payload limit, in characters of JSON. Free text is capped well below this in the UI. */
export const MAX_PAYLOAD_CHARS = 8000;

const NAME = /^[a-z][a-z0-9_]{0,39}$/;

function isEvent(e: unknown): e is IncomingEvent {
  if (typeof e !== "object" || e === null) return false;
  const v = e as Record<string, unknown>;
  return (
    Number.isInteger(v.seq) &&
    (v.seq as number) > 0 &&
    typeof v.client_ts === "string" &&
    !Number.isNaN(Date.parse(v.client_ts)) &&
    typeof v.step === "string" &&
    NAME.test(v.step) &&
    (v.machine === null || v.machine === undefined || (typeof v.machine === "string" && NAME.test(v.machine))) &&
    typeof v.event_type === "string" &&
    NAME.test(v.event_type) &&
    typeof v.payload === "object" &&
    v.payload !== null &&
    !Array.isArray(v.payload) &&
    JSON.stringify(v.payload).length <= MAX_PAYLOAD_CHARS
  );
}

/** Returns the events if every one is well-formed, otherwise null. */
export function parseBatch(events: unknown): IncomingEvent[] | null {
  if (!Array.isArray(events) || events.length === 0 || events.length > MAX_BATCH) return null;
  return events.every(isEvent) ? events : null;
}

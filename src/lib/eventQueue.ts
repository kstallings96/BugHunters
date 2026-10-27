/**
 * Durable event queue (the same design as Mosaic and Orbit).
 *
 * School wifi drops, so the game never waits on the network. Every event is
 * appended in memory and mirrored to storage at once; batches go out every
 * minute; nothing leaves the queue until the server confirms it. Events
 * stranded by a crash or a closed tab are sent on the next load.
 *
 * This module has no browser globals so it can be unit-tested; logger.ts
 * wires it to localStorage, fetch and sendBeacon.
 */

export interface QueuedEvent {
  sid: string;
  seq: number;
  client_ts: string;
  step: string;
  machine: string | null;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Posts one batch; resolves to the HTTP status, or 0 for a network error. */
export type Transport = (token: string, events: Omit<QueuedEvent, "sid">[]) => Promise<number>;

export interface QueueOptions {
  store: KeyValueStore;
  send: Transport;
  now?: () => number;
  batchSize?: number;
}

const QUEUE_KEY = "bh_event_queue";
const TOKENS_KEY = "bh_tokens";
const SEQ_KEY = "bh_seq";

function read<T>(store: KeyValueStore, key: string, fallback: T): T {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function createEventQueue({ store, send, now = Date.now, batchSize = 100 }: QueueOptions) {
  let queue: QueuedEvent[] = read(store, QUEUE_KEY, []);
  const tokens: Record<string, string> = read(store, TOKENS_KEY, {});
  const seqs: Record<string, number> = read(store, SEQ_KEY, {});
  // Sessions whose token the server rejected. Their events stay stored (a
  // researcher can recover them from the device) but are not resent.
  const blocked = new Set<string>();
  let flushing = false;
  let failures = 0;
  let retryAt = 0;

  function persist(): void {
    try {
      store.setItem(QUEUE_KEY, JSON.stringify(queue));
      store.setItem(TOKENS_KEY, JSON.stringify(tokens));
      store.setItem(SEQ_KEY, JSON.stringify(seqs));
    } catch {
      // Storage full or blocked: the in-memory queue still flushes, we only
      // lose crash recovery. Never let logging break the game.
    }
  }

  function register(sid: string, token: string): void {
    tokens[sid] = token;
    seqs[sid] ??= 0;
    persist();
  }

  function append(sid: string, step: string, eventType: string, payload: Record<string, unknown> = {}, machine: string | null = null): QueuedEvent {
    seqs[sid] = (seqs[sid] ?? 0) + 1;
    const event: QueuedEvent = {
      sid,
      seq: seqs[sid],
      client_ts: new Date(now()).toISOString(),
      step,
      machine,
      event_type: eventType,
      payload,
    };
    queue.push(event);
    persist();
    return event;
  }

  /** The oldest sendable session's next batch. */
  function nextBatch(limit = batchSize): { sid: string; token: string; events: QueuedEvent[] } | null {
    const head = queue.find((e) => !blocked.has(e.sid) && tokens[e.sid]);
    if (!head) return null;
    const events = queue.filter((e) => e.sid === head.sid).slice(0, limit);
    return { sid: head.sid, token: tokens[head.sid], events };
  }

  function strip(events: QueuedEvent[]): Omit<QueuedEvent, "sid">[] {
    return events.map((e) => ({
      seq: e.seq,
      client_ts: e.client_ts,
      step: e.step,
      machine: e.machine ?? null,
      event_type: e.event_type,
      payload: e.payload,
    }));
  }

  function remove(batch: QueuedEvent[]): void {
    const sent = new Set(batch);
    queue = queue.filter((e) => !sent.has(e));
    persist();
  }

  /** Sends batches until the queue is empty or a send fails. Never throws. */
  async function flush(): Promise<void> {
    if (flushing || now() < retryAt) return;
    flushing = true;
    try {
      for (let batch = nextBatch(); batch; batch = nextBatch()) {
        let status = 0;
        try {
          status = await send(batch.token, strip(batch.events));
        } catch {
          status = 0;
        }
        if (status >= 200 && status < 300) {
          remove(batch.events);
          failures = 0;
        } else if (status === 400) {
          // Malformed: retrying can never succeed and would block every
          // event behind it.
          remove(batch.events);
        } else if (status === 401 || status === 403) {
          blocked.add(batch.sid);
        } else {
          // Offline or server trouble: back off (2s, 4s, 8s … 30s) and keep
          // everything for the next attempt.
          failures += 1;
          retryAt = now() + Math.min(30_000, 1000 * 2 ** failures);
          return;
        }
      }
    } finally {
      flushing = false;
    }
  }

  /**
   * Last-chance send while the page is being hidden or closed. The events
   * stay queued because a beacon gives no confirmation; if they did arrive,
   * the resend on next load is ignored as a duplicate.
   */
  function beaconPayloads(maxBytes = 60_000, chunkSize = Math.min(batchSize, 25)): { token: string; events: Omit<QueuedEvent, "sid">[] }[] {
    const out: { token: string; events: Omit<QueuedEvent, "sid">[] }[] = [];
    let used = 0;
    const sids = [...new Set(queue.map((e) => e.sid))].filter((s) => !blocked.has(s) && tokens[s]);
    for (const sid of sids) {
      const events = queue.filter((e) => e.sid === sid);
      for (let i = 0; i < events.length; i += chunkSize) {
        const chunk = { token: tokens[sid], events: strip(events.slice(i, i + chunkSize)) };
        const size = JSON.stringify(chunk).length;
        if (used + size > maxBytes) return out;
        used += size;
        out.push(chunk);
      }
    }
    return out;
  }

  return {
    register,
    append,
    flush,
    beaconPayloads,
    pending: () => queue.length,
    snapshot: () => [...queue],
  };
}

export type EventQueue = ReturnType<typeof createEventQueue>;

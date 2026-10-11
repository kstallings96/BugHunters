"use client";

import { createEventQueue, type EventQueue, type KeyValueStore } from "./eventQueue";
import type { ClientSession, Step } from "./types";

/**
 * Browser wiring for the event queue: localStorage for durability, fetch for
 * regular batches, sendBeacon when the page is hidden. Logging failures are
 * swallowed; the game must keep working without a network.
 */

const SESSION_KEY = "bh_session";
const FLUSH_MS = 4000;

export type EventType =
  | "session_start"
  | "session_resume"
  | "session_end"
  | "step_enter"
  | "step_exit"
  | "readaloud"
  | "card_edit"
  | "card_submit"
  | "card_run"
  | "mode_toggle"
  | "app_interaction"
  | "flag_create"
  | "flag_delete"
  | "flag_cancel"
  | "app_event"
  | "ai_check_used"
  | "ai_check_closed"
  | "hunt_capped"
  | "done"
  | "reveal_view"
  | "fix_request_submit"
  | "survey_response";

let queue: EventQueue | null = null;
let session: ClientSession | null = null;
let currentStep: Step = "setup";
let timer: number | null = null;

function storage(): KeyValueStore {
  try {
    const s = window.localStorage;
    s.setItem("bh_probe", "1");
    return s;
  } catch {
    // Private mode or blocked storage: keep events in memory only.
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) };
  }
}

async function send(token: string, events: unknown[]): Promise<number> {
  try {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, events }),
    });
    return res.status;
  } catch {
    return 0;
  }
}

function onHide(): void {
  if (document.visibilityState !== "hidden" || !queue) return;
  for (const payload of queue.beaconPayloads()) {
    const body = JSON.stringify(payload);
    // Same-origin, so a JSON beacon is fine (no CORS preflight). If the
    // browser refuses it, keepalive fetch outlives the page the same way.
    const queued = navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }));
    if (!queued) {
      void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  }
}

/** Starts the queue once per page load and resends anything left from before. */
export function startLogger(): void {
  if (queue || typeof window === "undefined") return;
  queue = createEventQueue({ store: storage(), send });
  timer = window.setInterval(() => void queue?.flush(), FLUSH_MS);
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onHide);
  window.addEventListener("online", () => void queue?.flush());
  void queue.flush();
}

export function stopLogger(): void {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}

/** The session saved on this device, if a student is mid-game (survives reloads). */
export function savedSession(): ClientSession | null {
  if (session) return session;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    session = raw ? (JSON.parse(raw) as ClientSession) : null;
  } catch {
    session = null;
  }
  return session;
}

export function beginSession(s: ClientSession): void {
  startLogger();
  session = s;
  queue?.register(s.id, s.token);
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {}
}

export function setStep(step: Step): void {
  currentStep = step;
}

export function logEvent(type: EventType, payload: Record<string, unknown> = {}, step: Step = currentStep): void {
  if (!queue || !session) return;
  try {
    queue.append(session.id, step, type, payload);
  } catch {}
}

/**
 * Logs session_end and forgets the session so the next student on a shared
 * Chromebook starts fresh. Queued events keep sending.
 */
export function endSession(payload: Record<string, unknown> = {}): void {
  logEvent("session_end", payload);
  session = null;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {}
  void queue?.flush();
}

export function flushNow(): Promise<void> {
  return queue?.flush() ?? Promise.resolve();
}

export function pendingEvents(): number {
  return queue?.pending() ?? 0;
}

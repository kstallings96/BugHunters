"use client";

import { recordBackup, saveBackup, startBackup } from "./backup";
import { createEventQueue, type EventQueue, type KeyValueStore } from "./eventQueue";
import type { MachineId } from "@/machines/types";
import type { ClientSession, Step } from "./types";

/**
 * Browser wiring for the event queue: localStorage for durability, fetch for
 * regular batches, sendBeacon when the page is hidden. Logging failures are
 * swallowed; the game must keep working without a network.
 *
 * The current session lives in sessionStorage: a reload resumes it, and
 * closing the tab on a shared Chromebook forgets it. Queued events stay in
 * localStorage (no names in them) until the server has them.
 */

const SESSION_KEY = "bh_session";
const FLUSH_MS = 4000;

export type EventType =
  | "session_start"
  | "session_resume"
  | "session_end"
  | "step_enter"
  | "step_exit"
  | "survey_response"
  | "tutorial_step"
  | "input_submit"
  | "tries_used_up"
  | "busted_open"
  | "busted"
  | "busted_cancel"
  | "accept_machine"
  | "reveal_view"
  | "nudge_shown"
  | "nudge_response"
  | "facilitator_advance"
  | "bonus_enter"
  | "guilty_line_attempt";

let queue: EventQueue | null = null;
let session: ClientSession | null = null;
let currentStep: Step = "setup";
let currentMachine: MachineId | "raffle" | null = null;
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
  void saveBackup();
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
  timer = window.setInterval(() => {
    void queue?.flush();
    void saveBackup();
  }, FLUSH_MS);
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
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    session = raw ? (JSON.parse(raw) as ClientSession) : null;
  } catch {
    session = null;
  }
  return session;
}

/** Starts logging for a session, with an encrypted device backup when a key is given. */
export function beginSession(s: ClientSession, publicKey: string | null = null): void {
  startLogger();
  session = s;
  void startBackup(publicKey, {
    session_id: s.id,
    first_name: s.firstName,
    last_initial: s.lastInitial,
    class_period: s.period,
    machine_order: s.machineOrder,
    reveal_condition: s.revealCondition,
  });
  queue?.register(s.id, s.token);
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {}
}

/** Where the student is; every event is stamped with this step and machine. */
export function setStep(step: Step, machine: MachineId | "raffle" | null = null): void {
  currentStep = step;
  currentMachine = machine;
}

export function logEvent(type: EventType, payload: Record<string, unknown> = {}): void {
  if (!queue || !session) return;
  try {
    // The bonus is open play: every event in it is marked unmeasured.
    const tagged = currentStep.startsWith("bonus") ? { ...payload, measured: false } : payload;
    recordBackup(queue.append(session.id, currentStep, type, tagged, currentMachine));
  } catch {}
}

/**
 * Logs session_end and forgets the session so the next student on a shared
 * Chromebook starts fresh. Queued events keep sending.
 */
export function endSession(payload: Record<string, unknown> = {}): void {
  logEvent("session_end", payload);
  void saveBackup();
  session = null;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {}
  void queue?.flush();
}

export function flushNow(): Promise<void> {
  return queue?.flush() ?? Promise.resolve();
}

export function pendingEvents(): number {
  return queue?.pending() ?? 0;
}

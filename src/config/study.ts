import type { MachineId } from "@/machines/types";

/**
 * Study settings that may change between classes or schools. Values come
 * from environment variables (see .env.example); defaults are what the
 * study runs with.
 */

export interface StudySettings {
  /** Class periods students pick from. */
  periods: string[];
  /** Seconds on one machine before "Ready for the next app?" appears. Never auto-advances. */
  nudgeSeconds: number;
  /** Used to decide what "today" means when resuming a session by name. */
  timeZone: string;
}

function number(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function readStudySettings(env: Record<string, string | undefined> = process.env): StudySettings {
  const periods = (env.CLASS_PERIODS ?? "1,2,3,4,5,6,7,8")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    periods: periods.length ? periods : ["1"],
    nudgeSeconds: number(env.NUDGE_SECONDS, 300, 30, 3600),
    timeZone: env.SCHOOL_TIMEZONE?.trim() || "America/Chicago",
  };
}

/**
 * Machine order: one number machine first, the other second (random unless
 * forced with ?order=savings or ?order=sale), and Monster Namer third.
 */
export function machineOrder(param: string | null | undefined, random: () => number = Math.random): { order: MachineId[]; assignment: "random" | "url" } {
  const forced = param?.trim().toLowerCase();
  if (forced === "savings" || forced === "sale") {
    const first = forced as MachineId;
    return { order: [first, first === "savings" ? "sale" : "savings", "monster"], assignment: "url" };
  }
  return { order: random() < 0.5 ? ["savings", "sale", "monster"] : ["sale", "savings", "monster"], assignment: "random" };
}

export type RevealCondition = "reveal" | "end_only";

/**
 * Missed-bug reveal: everyone sees what they missed after each app. Until
 * Oct 29, 2026 it was 50/50 with "end_only" (one reveal after the last app);
 * those sessions keep their recorded condition.
 */
export function revealCondition(): { condition: RevealCondition; assignment: "all" } {
  return { condition: "reveal", assignment: "all" };
}

/** Start of "today" in the school's time zone, as an ISO instant. */
export function startOfToday(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  // Milliseconds already elapsed today in the school's zone.
  const sinceMidnight = ((get("hour") * 60 + get("minute")) * 60 + get("second")) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - sinceMidnight).toISOString();
}

/** Today's date in the school's time zone, like "2026-10-13" (leaderboards are per class per day). */
export function dayKey(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

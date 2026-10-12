import type { MachineId } from "@/machines/types";

/**
 * Study settings that may change between classes or schools. Values come
 * from environment variables (see .env.example); defaults are what the
 * study runs with.
 */

export interface StudySettings {
  /** Class periods students pick from. */
  periods: string[];
  /** Seconds on one machine before "Ready for the next machine?" appears. Never auto-advances. */
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
    nudgeSeconds: number(env.NUDGE_SECONDS, 180, 30, 3600),
    timeZone: env.SCHOOL_TIMEZONE?.trim() || "America/Chicago",
  };
}

/**
 * Machine order: one number machine first, the other second (random unless
 * forced with ?order=pizza or ?order=grade), and the Name Greeter third.
 */
export function machineOrder(param: string | null | undefined, random: () => number = Math.random): { order: MachineId[]; assignment: "random" | "url" } {
  const forced = param?.trim().toLowerCase();
  if (forced === "pizza" || forced === "grade") {
    const first = forced as MachineId;
    return { order: [first, first === "pizza" ? "grade" : "pizza", "name"], assignment: "url" };
  }
  return { order: random() < 0.5 ? ["pizza", "grade", "name"] : ["grade", "pizza", "name"], assignment: "random" };
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

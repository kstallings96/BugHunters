import type { Context, Inputs, Machine, Output } from "./types";

/**
 * Birthday Countdown (bonus). Month and day dropdowns allow every day 1–31,
 * so impossible dates are reachable.
 * Buggy: a birthday today says "365 days"; impossible dates (Feb 30) roll
 * over into the next month without a word.
 * Reference: "Happy birthday!" today; "That date doesn't exist" for
 * impossible dates. Feb 29 is debatable.
 */

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const DAY = 86_400_000;

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parts({ month, day }: Inputs) {
  return { m: Number(month), d: Number(day) };
}

/** Real in at least one year (Feb 29 counts: leap years). */
function exists(m: number, d: number): boolean {
  const probe = new Date(2024, m - 1, d);
  return probe.getMonth() === m - 1 && probe.getDate() === d;
}

function isToday(m: number, d: number, today: Date): boolean {
  return today.getMonth() === m - 1 && today.getDate() === d;
}

function daysText(days: number): string {
  return days === 1 ? "1 day until your birthday!" : `${days} days until your birthday!`;
}

function daysUntil(m: number, d: number, today: Date, sameDayIsNextYear: boolean): number {
  const now = midnight(today);
  let target = new Date(now.getFullYear(), m - 1, d);
  if (sameDayIsNextYear ? target <= now : target < now) target = new Date(now.getFullYear() + 1, m - 1, d);
  return Math.round((target.getTime() - now.getTime()) / DAY);
}

export const birthday: Machine = {
  id: "birthday",
  name: "Birthday Countdown",
  icon: "🎂",
  purpose: "Counts the days until your birthday.",
  fields: [
    { id: "month", label: "Month", kind: "select", options: MONTHS.map((label, i) => ({ value: String(i + 1), label })) },
    {
      id: "day",
      label: "Day",
      kind: "select",
      options: Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
    },
  ],
  // GLITCH: "on or before today" sends today to next year, and the Date
  // constructor quietly turns Feb 30 into March.
  buggy: (inputs: Inputs, { today }: Context): Output => {
    const { m, d } = parts(inputs);
    return { type: "result", text: daysText(daysUntil(m, d, today, true)) };
  },
  reference: (inputs: Inputs, { today }: Context): Output => {
    const { m, d } = parts(inputs);
    if (!exists(m, d)) return { type: "not_allowed", text: "That date doesn't exist.", rule: "out_of_range" };
    if (isToday(m, d, today)) return { type: "result", text: "Happy birthday! 🎂" };
    return { type: "result", text: daysText(daysUntil(m, d, today, false)) };
  },
  extraCategories: (inputs, { today }) => {
    const { m, d } = parts(inputs);
    if (!exists(m, d)) return ["out_of_range"];
    return isToday(m, d, today) ? ["boundary"] : [];
  },
  debatable: (inputs) => {
    const { m, d } = parts(inputs);
    return m === 2 && d === 29;
  },
  resultBugKind: () => "boundary",
  expectLabel: "a number of days",
  pseudocode: [
    "birthday = month + day",
    "if birthday is on or before today → use next year",
    "days = birthday − today",
    'show days + " days until your birthday!"',
  ],
  guiltyLine: (kind) => (kind === "boundary" ? 2 : "missing"),
};

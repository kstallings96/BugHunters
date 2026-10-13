import type { Category, MachineId } from "@/machines/types";

/** Where a student is. Logged as each event's `step`; `machine` is logged alongside. */
export type Step =
  | "setup"
  | "pre_survey"
  | "intro"
  | "tutorial"
  | "machine"
  | "post_survey"
  | "end"
  | "bonus_machine"
  | "bonus_guilty";

/** A real bug the student busted: one per kind per machine. */
export interface BustedBug {
  machine: MachineId;
  kind: Category;
  /** The input that showed it, for the bonus "find the guilty line". */
  inputs: Record<string, string>;
}

/** Enough to put a returning student back where they were. */
export interface Progress {
  step: Step;
  machineIndex: number;
  busted: BustedBug[];
}

/** What the browser keeps about the current session (sessionStorage). */
export interface ClientSession {
  id: string;
  token: string;
  machineOrder: MachineId[];
  nudgeSeconds: number;
  firstName: string;
  lastInitial: string;
  period: string;
  /** Present when the student chose "Keep going" on a session from earlier today. */
  progress: Progress | null;
}

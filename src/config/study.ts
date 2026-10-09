import type { Form } from "@/lib/types";

/**
 * Study settings that researchers may change between sessions. Values come
 * from environment variables so they can differ between Vercel environments
 * without a code change; defaults are what the study runs with.
 *
 * Server-side only: assignment happens in /api/session so a student can't
 * influence it except through the documented URL parameters.
 */

/** Forms that have content and an app. Form B is added in stage 4. */
export const AVAILABLE_FORMS: readonly Form[] = ["A"];

export interface StudySettings {
  /** "random", or a fixed form, used when the URL has no ?form=. */
  defaultForm: "random" | Form;
  /** Probability a session gets the AI checker when not forced by ?checker=. */
  aiCheckerRatio: number;
  /** Seconds before the hunt ends on its own. Not shown to students. */
  huntCapSeconds: number;
  /** Show the one-item survey before step 1 and after step 6. */
  surveyEnabled: boolean;
}

function number(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value !== undefined && value !== "" ? Math.min(max, Math.max(min, n)) : fallback;
}

export function readStudySettings(env: Record<string, string | undefined> = process.env): StudySettings {
  const form = env.DEFAULT_FORM?.trim().toUpperCase();
  return {
    defaultForm: form === "A" || form === "B" ? form : "random",
    aiCheckerRatio: number(env.AI_CHECKER_RATIO, 0.5, 0, 1),
    huntCapSeconds: number(env.HUNT_CAP_SECONDS, 480, 60, 3600),
    surveyEnabled: env.SURVEY_ENABLED?.trim().toLowerCase() === "true",
  };
}

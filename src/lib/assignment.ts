import type { StudySettings } from "@/config/study";
import type { Assignment, Condition, Form } from "./types";

export interface AssignmentResult {
  form: Form;
  formAssignment: Assignment;
  condition: Condition;
  conditionAssignment: Assignment;
}

export interface AssignmentParams {
  /** ?form=A|B */
  form?: string | null;
  /** ?checker=on|off */
  checker?: string | null;
}

/**
 * Picks the form and the AI-checker condition for a new session.
 * A valid URL parameter always wins; otherwise the configured default, and
 * otherwise a random draw. A parameter naming a form that isn't built yet is
 * ignored rather than trusted.
 */
export function assign(
  params: AssignmentParams,
  settings: StudySettings,
  availableForms: readonly Form[],
  random: () => number = Math.random,
): AssignmentResult {
  let form: Form;
  let formAssignment: Assignment;
  const askedForm = params.form?.trim().toUpperCase();
  if (askedForm && (availableForms as readonly string[]).includes(askedForm)) {
    form = askedForm as Form;
    formAssignment = "url";
  } else if (settings.defaultForm !== "random" && availableForms.includes(settings.defaultForm)) {
    form = settings.defaultForm;
    formAssignment = "default";
  } else if (availableForms.length === 1) {
    form = availableForms[0];
    formAssignment = "default";
  } else {
    form = availableForms[Math.floor(random() * availableForms.length) % availableForms.length];
    formAssignment = "random";
  }

  let condition: Condition;
  let conditionAssignment: Assignment;
  const checker = params.checker?.trim().toLowerCase();
  if (checker === "on" || checker === "off") {
    condition = checker === "on" ? "ai_checker" : "no_checker";
    conditionAssignment = "url";
  } else {
    condition = random() < settings.aiCheckerRatio ? "ai_checker" : "no_checker";
    conditionAssignment = "random";
  }

  return { form, formAssignment, condition, conditionAssignment };
}

export type Form = "A" | "B";
export type Condition = "ai_checker" | "no_checker";
export type Assignment = "random" | "url" | "default";

/** The game's steps, plus the setup screens before step 1. */
export type Step =
  | "setup"
  | "survey_pre"
  | "meet"
  | "test"
  | "done"
  | "reveal"
  | "fix"
  | "survey_post"
  | "end";

/** What the browser keeps about the current session. */
export interface ClientSession {
  id: string;
  token: string;
  form: Form;
  condition: Condition;
  huntCapSeconds: number;
  surveyEnabled: boolean;
  firstName: string;
}

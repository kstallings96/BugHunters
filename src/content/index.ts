import type { Form } from "@/lib/types";
import { formA } from "./formA";
import type { FormContent } from "./types";

export const FORMS: Partial<Record<Form, FormContent>> = { A: formA };

export function getForm(id: Form): FormContent {
  return FORMS[id] ?? formA;
}

/**
 * The survey item, word for word with its options in this order (from the
 * study protocol). Shown before step 1 and after step 6 when enabled.
 */
export const SURVEY = {
  question:
    "Your friend asked an AI to build a game for them. The game shows up and looks great. What should you do first?",
  options: [
    { id: "a", text: "Share it. If it looks right, it works." },
    { id: "b", text: "Ask the AI if the game has any problems." },
    { id: "c", text: "Use it like your friend would, and check what they asked for." },
    { id: "d", text: "Ask the AI to build it again, just in case." },
  ],
} as const;

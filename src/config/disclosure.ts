/**
 * What the intro says about who wrote the apps. It must match the truth
 * recorded in generation/DISCLOSURE.md:
 *   - "handwritten": people wrote every app (before the generation script ran)
 *   - "generated_with_planted": an AI wrote them; some bugs were added by hand
 *   - "generated": an AI wrote them; every bug is the AI's own
 */
export type Disclosure = "handwritten" | "generated_with_planted" | "generated";

export const DISCLOSURE: Disclosure = "handwritten";

export const DISCLOSURE_LINE: Record<Disclosure, string | null> = {
  handwritten: "Practice version: people wrote these apps to act like AI-built ones.",
  generated_with_planted: "An AI wrote these apps. We kept the bugs it made, and added a few.",
  generated: null,
};

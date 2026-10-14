/**
 * The only survey items inside the tool, asked right after login. Pre/post
 * surveys happen outside the tool and join on first name, last initial and
 * class period. Classic 5-point Likert items: a statement with examples,
 * then Strongly disagree (1) to Strongly agree (5), logged as 1–5.
 */

export interface SurveyQuestion {
  id: "coding_experience" | "ai_confidence";
  /** The statement students agree or disagree with. */
  question: string;
  /** Examples, shown under the statement. */
  examples: string;
  options: string[];
}

export const LIKERT = ["Strongly disagree", "Disagree", "Neither agree nor disagree", "Agree", "Strongly agree"];

export const INTAKE: SurveyQuestion[] = [
  {
    id: "coding_experience",
    question: "I have experience writing code.",
    examples: "For example: Scratch, Code.org, Python, or making games or websites.",
    options: LIKERT,
  },
  {
    id: "ai_confidence",
    question: "I feel confident using AI tools.",
    examples: "For example: ChatGPT, Gemini, Copilot, or Snapchat My AI.",
    options: LIKERT,
  },
];

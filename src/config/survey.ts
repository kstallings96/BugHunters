/**
 * The only survey items inside the tool, asked right after login. Pre/post
 * surveys happen outside the tool and join on first name, last initial and
 * class period. Each is a 5-point scale where every point has a label and
 * an example of what it looks like, logged as 1 (lowest) to 5 (highest).
 */

export interface SurveyChoice {
  label: string;
  /** What this choice looks like, so students pick the same way. */
  example: string;
}

export interface SurveyQuestion {
  id: "coding_experience" | "ai_confidence";
  question: string;
  /** Examples for the question itself, shown under it. */
  examples: string;
  choices: SurveyChoice[];
}

export const INTAKE: SurveyQuestion[] = [
  {
    id: "coding_experience",
    question: "How much have you coded before?",
    examples: "Coding is anything like Scratch, Code.org, Python, or making games or websites.",
    choices: [
      { label: "Never", example: "I've never written code." },
      { label: "Once or twice", example: "Like one Hour of Code." },
      { label: "Sometimes", example: "A few projects in class." },
      { label: "Often", example: "A coding class or club." },
      { label: "A lot", example: "I make my own games, apps or websites." },
    ],
  },
  {
    id: "ai_confidence",
    question: "How confident are you using AI tools?",
    examples: "AI tools are things like ChatGPT, Gemini, Copilot or Snapchat My AI.",
    choices: [
      { label: "Not at all", example: "I've never used one." },
      { label: "A little", example: "I've tried one, but I'm not sure how." },
      { label: "Somewhat", example: "I can ask it simple things." },
      { label: "Pretty confident", example: "I use one often and get what I need." },
      { label: "Very confident", example: "I could teach a friend to use one well." },
    ],
  },
];

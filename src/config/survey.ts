/**
 * The only survey items inside the tool, asked right after login. Pre/post
 * surveys happen outside the tool and join on first name, last initial and
 * class period. Word for word, options in this order (1 = first).
 */

export interface SurveyQuestion {
  id: "coding_experience" | "ai_confidence";
  question: string;
  options: string[];
}

export const INTAKE: SurveyQuestion[] = [
  {
    id: "coding_experience",
    question: "How much coding have you done before today?",
    options: [
      "Never",
      "A little (like one class activity or an Hour of Code)",
      "Some (a class or club for a few weeks)",
      "A lot (lots of projects, maybe outside school too)",
    ],
  },
  {
    id: "ai_confidence",
    question: "How confident are you using AI tools, like chatbots?",
    options: ["I've never used one", "Not very confident", "Somewhat confident", "Very confident"],
  },
];

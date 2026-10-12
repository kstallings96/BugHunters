/**
 * The one in-game survey item, asked before the tutorial: a 5-point scale.
 * Word for word; option order matters (1 = least).
 */

export interface SurveyQuestion {
  id: string;
  question: string;
  options: { id: string; text: string }[];
}

export const CODING_QUESTION: SurveyQuestion = {
  id: "coding_experience",
  question: "How much coding have you done before today?",
  options: [
    { id: "1", text: "None" },
    { id: "2", text: "A little" },
    { id: "3", text: "Some" },
    { id: "4", text: "A lot" },
    { id: "5", text: "A whole lot" },
  ],
};

/**
 * Survey items, word for word and in this option order (study protocol).
 * The birthday question is asked before the machines and again at the end.
 */

export interface SurveyQuestion {
  id: string;
  question: string;
  options: { id: string; letter?: string; text: string }[];
}

export const CODING_QUESTION: SurveyQuestion = {
  id: "coding_experience",
  question: "How much coding have you done before today?",
  options: [
    { id: "never", text: "Never" },
    { id: "a_little", text: "A little (like one class activity or an Hour of Code)" },
    { id: "some", text: "Some (a class or club for a few weeks)" },
    { id: "a_lot", text: "A lot (lots of projects, maybe outside school too)" },
  ],
};

export const BIRTHDAY_QUESTION: SurveyQuestion = {
  id: "birthday_next",
  question:
    "An AI built an app that counts the days until your birthday. You typed in your birthday, and it worked. What should you try next?",
  options: [
    { id: "a", letter: "a", text: "Your friend's birthday" },
    { id: "b", letter: "b", text: "A birthday that is today" },
    { id: "c", letter: "c", text: "Nothing. It works, so you're done." },
    { id: "d", letter: "d", text: "Ask the AI if the app works." },
  ],
};

import type { FormContent } from "./types";

/** Form A: Maya, age 7, times-tables game. */
export const formA: FormContent = {
  id: "A",
  client: { name: "Maya", age: 7, avatar: "👧🏽" },
  appName: "Maya's Times Tables",
  requestText:
    "I want a game to practice my 6, 7, and 8 times tables. Big buttons please. No timer, timers make me nervous. If I get one wrong, ask me again later. Make it purple!",
  requestItems: [
    { id: "tables", icon: "🔢", label: "Only 6, 7, and 8 times tables" },
    { id: "big_buttons", icon: "👆", label: "Big buttons" },
    { id: "no_timer", icon: "🚫⏰", label: "No timer" },
    { id: "ask_again", icon: "🔁", label: "Ask again if I get one wrong" },
    { id: "purple", icon: "💜", label: "Make it purple" },
  ],
  glitchDefinition: "A glitch is anything that doesn't match what Maya asked for.",
  card: {
    whenStarters: ["get one wrong", "tap an answer", "play for a while", "look at the screen"],
    shouldStarters: ["ask me again later", "have no timer", "only show 6, 7, and 8", "have big buttons", "be purple"],
  },
  glitches: [
    {
      id: "timer",
      kind: "visible",
      requestItem: "no_timer",
      features: ["countdown_bar"],
      title: "A timer bar at the top",
      howToFind: "It was at the top the whole time. Maya said no timer!",
      shortName: "The timer bar",
    },
    {
      id: "two_times_three",
      kind: "interaction",
      requestItem: "tables",
      features: ["question"],
      title: "A 2 × 3 question",
      howToFind: "You had to keep playing. Question 5 was 2 × 3.",
      shortName: "The 2 × 3 question",
    },
    {
      id: "never_again",
      kind: "sequence",
      requestItem: "ask_again",
      features: ["question", "answer_button", "feedback", "finish_message"],
      title: "Missed questions never came back",
      howToFind: "You had to miss one on purpose, then play to the end.",
      shortName: "Missed questions",
    },
    {
      id: "double_tap",
      kind: "broken",
      requestItem: null,
      features: ["answer_button", "question"],
      title: "Tapping twice skips a question",
      howToFind: "You had to tap an answer two times, fast.",
      shortName: "The double tap",
    },
  ],
  redHerrings: [
    {
      id: "purple",
      kind: "requested",
      requestItem: "purple",
      features: ["background"],
      title: "The purple color",
      why: "Maya asked for purple, so it's not a glitch.",
    },
    {
      id: "owl",
      kind: "extra",
      requestItem: null,
      features: ["owl"],
      title: "The owl",
      why: "Maya didn't ask for an owl, but it doesn't break anything.",
    },
  ],
  features: [
    { id: "start_button", label: "Start button", interactive: true },
    { id: "answer_button", label: "Answer buttons", interactive: true },
    { id: "owl", label: "Owl", interactive: true },
    { id: "play_again_button", label: "Play again button", interactive: true },
    { id: "question", label: "Question", interactive: false },
    { id: "countdown_bar", label: "Bar at the top", interactive: false },
    { id: "feedback", label: "Right / wrong message", interactive: false },
    { id: "score", label: "Stars", interactive: false },
    { id: "title", label: "Title", interactive: false },
    { id: "finish_message", label: "Last screen", interactive: false },
    { id: "background", label: "Background", interactive: false },
  ],
  checker: {
    answer:
      "I checked Maya's app. I found 1 glitch: there is a timer bar at the top, and Maya said no timer. Everything else looks great! The app is ready for Maya.",
    caught: ["timer"],
  },
};

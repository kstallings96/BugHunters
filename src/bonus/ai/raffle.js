// Written by google/gemini-3.1-flash-lite via OpenRouter: generation/runs/2026-10-13T17-15-39-803Z/raffle/sample-01.js
// Copied unchanged except for `export` and the PLANTED lines marked below.
// See generation/DISCLOSURE.md.
export function pickWinner(namesText) {
  const lines = namesText.split('\n');
  const names = lines.map(name => name.trim()).filter(name => name.length > 0);
  
  if (names.length === 0) {
    return "No names provided";
  }
  
  // PLANTED by the research team (the AI wrote `names.length`): the last name can never win.
  const randomIndex = Math.floor(Math.random() * (names.length - 1));
  return names[randomIndex];
}

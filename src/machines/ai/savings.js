// Written by google/gemini-3.1-flash-lite via OpenRouter: generation/runs/2026-10-13T17-15-39-803Z/savings/sample-03.js
// Copied unchanged except for `export` and the PLANTED lines marked below.
// See generation/DISCLOSURE.md.
export function weeksToSave(price, savedPerWeek) {
  const target = parseFloat(price);
  const weekly = parseFloat(savedPerWeek);

  // PLANTED by the research team (the AI wrote `weekly <= 0`): saving $0 a week now gets through.
  if (isNaN(target) || isNaN(weekly) || weekly < 0) {
    return "Invalid input";
  }

  // PLANTED by the research team (the AI wrote Math.ceil): rounds to the nearest week, not up.
  const weeks = Math.round(target / weekly);
  return weeks === 1 ? "1 week" : weeks + " weeks";
}

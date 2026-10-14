// Written by google/gemini-3.1-flash-lite via OpenRouter: generation/runs/2026-10-13T17-15-39-803Z/allowance/sample-03.js
// Copied unchanged except for `export` and nothing else.
// See generation/DISCLOSURE.md.
export function doubleAllowance(allowance) {
  const numericValue = parseFloat(allowance.replace(/[^0-9.]/g, ''));
  return "$" + (numericValue * 2);
}

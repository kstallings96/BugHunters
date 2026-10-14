// Written by google/gemini-3.1-flash-lite via OpenRouter: generation/runs/2026-10-13T17-15-39-803Z/sale/sample-04.js
// Copied unchanged except for `export` and nothing else.
// See generation/DISCLOSURE.md.
export function salePrice(price, percentOff) {
  const p = parseFloat(price);
  const discount = parseFloat(percentOff);
  const finalPrice = p - (p * (discount / 100));
  return "Sale price: $" + finalPrice.toFixed(2);
}

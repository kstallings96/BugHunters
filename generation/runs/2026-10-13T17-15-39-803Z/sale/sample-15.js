function salePrice(price, percentOff) {
  const p = parseFloat(price);
  const d = parseFloat(percentOff);

  if (isNaN(p) || isNaN(d) || p < 0 || d < 0 || d > 100) {
    return "Invalid input";
  }

  const finalPrice = p - (p * (d / 100));
  return "Sale price: $" + finalPrice.toFixed(2);
}

function salePrice(price, percentOff) {
  const p = parseFloat(price);
  const d = parseFloat(percentOff);

  if (isNaN(p) || isNaN(d) || p < 0 || d < 0 || d > 100) {
    return "Invalid input";
  }

  const discountAmount = p * (d / 100);
  const finalPrice = Math.round((p - discountAmount) * 100) / 100;

  return "Sale price: $" + finalPrice.toFixed(2).replace(/\.00$/, "");
}

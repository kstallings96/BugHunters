function salePrice(price, percentOff) {
  const cleanPrice = parseFloat(price.replace(/[^0-9.]/g, ""));
  const cleanPercent = parseFloat(percentOff.replace(/[^0-9.]/g, ""));

  if (isNaN(cleanPrice) || isNaN(cleanPercent)) {
    return "Invalid input";
  }

  const discountDecimal = Math.max(0, Math.min(100, cleanPercent)) / 100;
  const finalPrice = cleanPrice * (1 - discountDecimal);

  return "Sale price: $" + finalPrice.toFixed(2);
}

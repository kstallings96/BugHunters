function salePrice(price, percentOff) {
  const originalPrice = parseFloat(price.replace(/[^0-9.]/g, ''));
  const discountPercent = parseFloat(percentOff.replace(/[^0-9.]/g, ''));

  if (isNaN(originalPrice) || isNaN(discountPercent) || originalPrice < 0 || discountPercent < 0 || discountPercent > 100) {
    return "Invalid input";
  }

  const discountAmount = originalPrice * (discountPercent / 100);
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  return "Sale price: $" + finalPrice.toFixed(2);
}

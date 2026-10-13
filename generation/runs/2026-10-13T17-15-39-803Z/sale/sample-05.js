function salePrice(price, percentOff) {
  const p = parseFloat(price.replace(/[^0-9.]/g, ''));
  const discount = parseFloat(percentOff.replace(/[^0-9.]/g, ''));

  if (isNaN(p) || isNaN(discount)) {
    return "Invalid input";
  }

  const finalPrice = p * (1 - (discount / 100));
  
  return "Sale price: $" + finalPrice.toFixed(2);
}

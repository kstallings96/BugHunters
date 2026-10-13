function doubleAllowance(allowance) {
  const numericPart = allowance.replace(/[^0-9.]/g, '');
  const currencySymbol = allowance.replace(/[0-9.]/g, '');
  const doubledAmount = parseFloat(numericPart) * 2;
  return currencySymbol + doubledAmount;
}

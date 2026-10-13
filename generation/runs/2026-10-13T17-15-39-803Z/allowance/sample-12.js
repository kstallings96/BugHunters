function doubleAllowance(allowance) {
  const numericValue = parseFloat(allowance.replace(/[^0-9.]/g, ''));
  const doubledValue = numericValue * 2;
  const symbol = allowance.replace(/[0-9.]/g, '');
  return symbol + doubledValue.toString();
}

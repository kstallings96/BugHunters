function doubleAllowance(allowance) {
  const numericValue = parseFloat(allowance.replace(/[^0-9.]/g, ''));
  const doubledValue = numericValue * 2;
  return "$" + doubledValue;
}

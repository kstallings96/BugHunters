function doubleAllowance(allowance) {
  const numericValue = parseFloat(allowance.replace(/[^0-9.]/g, ''));
  if (isNaN(numericValue)) {
    return "Invalid input";
  }
  const doubledValue = numericValue * 2;
  return "$" + doubledValue;
}

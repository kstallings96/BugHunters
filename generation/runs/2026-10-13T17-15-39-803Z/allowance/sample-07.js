function doubleAllowance(allowance) {
  const numericPart = parseFloat(allowance.replace(/[^0-9.]/g, ''));
  if (isNaN(numericPart)) {
    return "Invalid input";
  }
  const doubled = numericPart * 2;
  return "$" + doubled;
}

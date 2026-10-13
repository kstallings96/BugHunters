function doubleAllowance(allowance) {
  const amount = parseFloat(allowance.replace(/[^0-9.]/g, ''));
  if (isNaN(amount)) {
    return "Please enter a valid number";
  }
  return "$" + (amount * 2);
}

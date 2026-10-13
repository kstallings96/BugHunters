function doubleAllowance(allowance) {
  const amount = parseFloat(allowance.replace(/[^0-9.]/g, ''));
  const symbol = allowance.replace(/[0-9.]/g, '');
  return symbol + (amount * 2);
}

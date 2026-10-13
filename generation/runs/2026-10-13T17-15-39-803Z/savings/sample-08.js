function weeksToSave(price, savedPerWeek) {
  const priceNum = parseFloat(price);
  const savingsNum = parseFloat(savedPerWeek);

  if (isNaN(priceNum) || isNaN(savingsNum) || savingsNum <= 0 || priceNum < 0) {
    return "Invalid input";
  }

  if (priceNum === 0) {
    return "0 weeks";
  }

  const weeks = Math.ceil(priceNum / savingsNum);
  return weeks === 1 ? "1 week" : weeks + " weeks";
}

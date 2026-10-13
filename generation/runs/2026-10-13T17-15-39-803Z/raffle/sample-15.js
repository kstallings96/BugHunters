function pickWinner(namesText) {
  const lines = namesText.split('\n');
  const validNames = lines.map(line => line.trim()).filter(line => line.length > 0);
  
  if (validNames.length === 0) {
    return "No names provided.";
  }
  
  const randomIndex = Math.floor(Math.random() * validNames.length);
  return validNames[randomIndex];
}

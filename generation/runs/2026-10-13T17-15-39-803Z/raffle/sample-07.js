function pickWinner(namesText) {
  const lines = namesText.split(/\r?\n/);
  const names = lines.filter(line => line.trim() !== "");
  
  if (names.length === 0) {
    return "No names provided.";
  }
  
  const randomIndex = Math.floor(Math.random() * names.length);
  return names[randomIndex].trim();
}

function pickWinner(namesText) {
  const names = namesText.split('\n').map(name => name.trim()).filter(name => name !== '');
  
  if (names.length === 0) {
    return "No names provided.";
  }
  
  const randomIndex = Math.floor(Math.random() * names.length);
  return names[randomIndex];
}

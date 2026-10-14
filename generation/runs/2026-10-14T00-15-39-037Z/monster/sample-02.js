function monsterName(name) {
  const sanitized = name.toUpperCase().replace(/[^A-Z]/g, '');
  const finalName = sanitized.substring(0, 12);
  return finalName || "UNNAMED";
}

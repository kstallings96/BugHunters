function monsterName(name) {
  var prefix = "KRAK-";
  var combined = (prefix + name).toUpperCase();
  return combined.substring(0, 12);
}

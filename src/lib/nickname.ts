/**
 * Leaderboard nicknames, so no real name is ever shown to classmates. Made
 * from fixed, kid-safe word lists and the session id, so the same session
 * always gets the same nickname on the student's screen and the server's.
 */

const ADJECTIVES = [
  "Sneaky", "Speedy", "Clever", "Brave", "Sharp", "Lucky", "Mighty", "Swift", "Bold", "Quiet",
  "Curious", "Jolly", "Zippy", "Fuzzy", "Sparkly", "Cosmic", "Turbo", "Super", "Daring", "Witty",
  "Bouncy", "Electric", "Golden", "Silver", "Rapid", "Steady", "Keen", "Nimble", "Plucky", "Radiant",
];

const CRITTERS = [
  "Beetle", "Firefly", "Ladybug", "Cricket", "Hornet", "Moth", "Mantis", "Dragonfly", "Ant", "Bumblebee",
  "Gecko", "Otter", "Falcon", "Fox", "Panda", "Owl", "Koala", "Badger", "Dolphin", "Penguin",
  "Lynx", "Raccoon", "Hedgehog", "Squirrel", "Tiger", "Hawk", "Turtle", "Rabbit", "Llama", "Narwhal",
];

/** Small stable hash (FNV-1a). */
function hash(text: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** "Sneaky Beetle 42": 30 × 30 × 90 combinations, so classmates almost never share one. */
export function nicknameFor(sessionId: string): string {
  const adjective = ADJECTIVES[hash(sessionId, 1) % ADJECTIVES.length];
  const critter = CRITTERS[hash(sessionId, 2) % CRITTERS.length];
  const number = 10 + (hash(sessionId, 3) % 90);
  return `${adjective} ${critter} ${number}`;
}

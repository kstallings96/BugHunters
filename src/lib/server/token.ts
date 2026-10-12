import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A session token is "<session id>.<HMAC of the id>". It proves the events
 * being posted belong to a session this server created, without a database
 * lookup and without exposing anything secret to the browser.
 */

function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 32 ? s : null;
}

function sign(id: string, key: string): string {
  return createHmac("sha256", key).update(id).digest("base64url");
}

export function issueToken(sessionId: string): string | null {
  const key = secret();
  return key ? `${sessionId}.${sign(sessionId, key)}` : null;
}

/** Returns the session id if the token is genuine, otherwise null. */
export function verifyToken(token: unknown): string | null {
  const key = secret();
  if (!key || typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(id, key));
  return given.length === expected.length && timingSafeEqual(given, expected) ? id : null;
}

/** Constant-time comparison for the classroom access code. Case-insensitive, spaces ignored at the ends. */
export function accessCodeMatches(given: unknown): boolean {
  const code = process.env.ACCESS_CODE?.trim();
  if (!code || typeof given !== "string") return false;
  const a = Buffer.from(given.trim().toLowerCase());
  const b = Buffer.from(code.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

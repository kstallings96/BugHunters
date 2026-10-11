import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issueToken, verifyToken } from "@/lib/server/token";

describe("session tokens", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.SESSION_SECRET = "x".repeat(40);
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("round-trips a session id", () => {
    const id = "6f1c2c1e-0000-4000-8000-000000000001";
    expect(verifyToken(issueToken(id))).toBe(id);
  });
  it("rejects forged or altered tokens", () => {
    const token = issueToken("6f1c2c1e-0000-4000-8000-000000000001")!;
    expect(verifyToken(token.replace("0001", "0002"))).toBeNull();
    expect(verifyToken(token + "a")).toBeNull();
    expect(verifyToken("nope")).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
    process.env.SESSION_SECRET = "y".repeat(40);
    expect(verifyToken(token)).toBeNull();
  });
  it("refuses to issue tokens with a short or missing secret", () => {
    process.env.SESSION_SECRET = "short";
    expect(issueToken("abc")).toBeNull();
  });
});

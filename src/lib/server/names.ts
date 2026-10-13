import "server-only";
import { createHmac, constants, publicEncrypt } from "node:crypto";
import type { StudentName } from "@/lib/identity";

/**
 * Student names never sit readable in cloud storage. The site encrypts them
 * with the researcher's PUBLIC key (NAMES_PUBLIC_KEY); only the private key
 * on the researcher's laptop (npm run keys) can read them, in npm run pull.
 *
 * "Keep going where you left off?" still needs to find a student by name,
 * so the server also stores a keyed fingerprint (HMAC with SESSION_SECRET)
 * of the normalized name and period: it can match, but not read, a name.
 */

export function publicKeyPem(): string | null {
  // Tolerate quotes around the value (some env tools add them).
  const b64 = process.env.NAMES_PUBLIC_KEY?.trim().replace(/^"|"$/g, "");
  return b64 ? `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----\n` : null;
}

/** RSA-OAEP (SHA-256) with the researcher's public key, base64. */
export function encryptName(name: StudentName, pem: string): string {
  const plain = Buffer.from(JSON.stringify({ first_name: name.firstName, last_initial: name.lastInitial }));
  return publicEncrypt({ key: pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, plain).toString("base64");
}

/** Keyed fingerprint of a name and period, case-insensitive. */
export function nameKey(name: StudentName, period: string): string {
  const secret = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", secret)
    .update(`${name.firstName.toLowerCase()}|${name.lastInitial.toUpperCase()}|${period}`)
    .digest("hex")
    .slice(0, 32);
}

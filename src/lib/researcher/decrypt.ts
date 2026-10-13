import { constants, createDecipheriv, privateDecrypt } from "node:crypto";

/**
 * Researcher-side decryption (Node only; runs in npm run pull, never in the
 * deployed app). Pairs with src/lib/server/names.ts (names) and
 * src/lib/backup.ts (device backups).
 */

const oaep = (pem: string, data: Buffer) => privateDecrypt({ key: pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, data);

export function decryptName(nameEnc: string, privatePem: string): { first_name: string; last_initial: string } {
  return JSON.parse(oaep(privatePem, Buffer.from(nameEnc, "base64")).toString("utf8"));
}

export interface BackupRecord {
  v: number;
  sid: string;
  chunk: string;
  saved_at: string;
  wrapped_key: string;
  iv: string;
  data: string;
}

export interface BackupContents {
  meta: { session_id: string; first_name: string; last_initial: string; class_period: string; machine_order: string[]; reveal_condition: string };
  events: { sid: string; seq: number; client_ts: string; step: string; machine: string | null; event_type: string; payload: Record<string, unknown> }[];
}

/** WebCrypto AES-GCM output is ciphertext followed by the 16-byte tag. */
export function decryptBackupRecord(r: BackupRecord, privatePem: string): BackupContents {
  const key = oaep(privatePem, Buffer.from(r.wrapped_key, "base64"));
  const data = Buffer.from(r.data, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(r.iv, "base64"));
  decipher.setAuthTag(data.subarray(data.length - 16));
  const plain = Buffer.concat([decipher.update(data.subarray(0, data.length - 16)), decipher.final()]);
  return JSON.parse(plain.toString("utf8"));
}

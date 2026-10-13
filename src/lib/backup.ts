"use client";

/**
 * Backup copy of every event on the student's own device, in case the
 * cloud copy is lost (school wifi, an outage). Shared Chromebooks pass from
 * student to student, so the copy is ENCRYPTED with the researcher's public
 * key: nobody on the device can read it, only npm run pull on the
 * researcher's laptop.
 *
 * Hybrid encryption (WebCrypto): a fresh AES-256-GCM key per page load
 * encrypts the session's events; RSA-OAEP (SHA-256) wraps that AES key.
 * Each page load writes its own chunk, re-encrypted as events arrive:
 *   localStorage["bh_backup:<session>:<chunk>"] = { v, sid, chunk, saved_at, wrapped_key, iv, data }
 * Staff download every chunk on a device from /backup.
 */

const PREFIX = "bh_backup:";

export interface BackupMeta {
  session_id: string;
  first_name: string;
  last_initial: string;
  class_period: string;
  machine_order: string[];
  reveal_condition: string;
}

let rsa: CryptoKey | null = null;
let aes: CryptoKey | null = null;
let wrappedKey = "";
let meta: BackupMeta | null = null;
let events: unknown[] = [];
let chunk = "";
let dirty = false;
let saving: Promise<void> | null = null;

/** Base64 in slices: spreading a large byte array into one call would overflow the stack. */
function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Starts a backup chunk for this session. Does nothing without a public key or WebCrypto. */
export async function startBackup(publicKeyB64: string | null, m: BackupMeta): Promise<void> {
  if (!publicKeyB64 || !globalThis.crypto?.subtle) return;
  // Start collecting now (the first events arrive before the keys are ready);
  // encryption begins once they are.
  meta = m;
  events = [];
  aes = null;
  chunk = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  try {
    rsa = await crypto.subtle.importKey("spki", fromB64(publicKeyB64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
    wrappedKey = b64(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, rsa, await crypto.subtle.exportKey("raw", key)));
    aes = key;
  } catch {
    meta = null;
    events = [];
  }
}

export function recordBackup(event: unknown): void {
  if (!meta) return;
  events.push(event);
  dirty = true;
}

/** Encrypts this chunk and writes it to localStorage. Never throws. */
export function saveBackup(): Promise<void> {
  if (!aes || !meta || !dirty) return Promise.resolve();
  if (saving) return saving;
  dirty = false;
  const key = aes;
  const body = JSON.stringify({ meta, events });
  saving = (async () => {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(body));
      const record = { v: 1, sid: meta!.session_id, chunk, saved_at: new Date().toISOString(), wrapped_key: wrappedKey, iv: b64(iv), data: b64(data) };
      localStorage.setItem(`${PREFIX}${meta!.session_id}:${chunk}`, JSON.stringify(record));
    } catch {
      // Storage full or blocked: the cloud copy is still the main record.
    } finally {
      saving = null;
    }
  })();
  return saving;
}

/** Everything backed up on this device, for /backup. */
export function deviceBackups(): { sessions: number; chunks: number; file: string } {
  const records: unknown[] = [];
  const sids = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (!k.startsWith(PREFIX)) continue;
      const r = JSON.parse(localStorage.getItem(k)!);
      records.push(r);
      sids.add(r.sid);
    }
  } catch {}
  return { sessions: sids.size, chunks: records.length, file: JSON.stringify({ bughunters_device_backup: 1, exported_at: new Date().toISOString(), records }) };
}

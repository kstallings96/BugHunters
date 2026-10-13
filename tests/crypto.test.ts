import { generateKeyPairSync } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { deviceBackups, recordBackup, saveBackup, startBackup } from "@/lib/backup";
import { decryptBackupRecord, decryptName } from "@/lib/researcher/decrypt";
import { encryptName, nameKey, publicKeyPem } from "@/lib/server/names";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "der" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const PUB = Buffer.from(publicKey).toString("base64");

beforeAll(() => {
  process.env.NAMES_PUBLIC_KEY = PUB;
  process.env.SESSION_SECRET = "x".repeat(40);
  // A tiny localStorage for the browser-side backup code.
  const mem = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
  } as Storage;
});

describe("names in the cloud", () => {
  it("are encrypted with the public key and read back only with the private key", () => {
    const enc = encryptName({ firstName: "Jayden", lastInitial: "R" }, publicKeyPem()!);
    expect(enc).not.toContain("Jayden");
    expect(decryptName(enc, privateKey)).toEqual({ first_name: "Jayden", last_initial: "R" });
  });

  it("can be matched (for Keep going?) without being readable", () => {
    const a = nameKey({ firstName: "Jayden", lastInitial: "R" }, "3");
    expect(nameKey({ firstName: "jayden", lastInitial: "r" }, "3")).toBe(a);
    expect(nameKey({ firstName: "Jayden", lastInitial: "R" }, "4")).not.toBe(a);
    expect(a).not.toMatch(/jayden/i);
  });
});

describe("device backup", () => {
  it("is encrypted on the device and decrypts on the researcher's laptop", async () => {
    const meta = { session_id: "s-1", first_name: "Maya", last_initial: "T", class_period: "2", machine_order: ["savings", "sale", "jersey"], reveal_condition: "reveal" };
    const started = startBackup(PUB, meta);
    // An event logged before the keys are ready is still kept.
    recordBackup({ sid: "s-1", seq: 1, event_type: "session_start" });
    await started;
    for (let seq = 2; seq <= 300; seq++) recordBackup({ sid: "s-1", seq, event_type: "input_submit", payload: { inputs: { price: "20" } } });
    await saveBackup();

    const { sessions, chunks, file } = deviceBackups();
    expect([sessions, chunks]).toEqual([1, 1]);
    expect(file).not.toContain("Maya");
    const record = JSON.parse(file).records[0];
    const out = decryptBackupRecord(record, privateKey);
    expect(out.meta).toEqual(meta);
    expect(out.events).toHaveLength(300);
    expect(out.events[0]).toMatchObject({ seq: 1, event_type: "session_start" });
  });
});

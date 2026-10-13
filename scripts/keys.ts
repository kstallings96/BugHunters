/**
 * Makes the researcher's key pair for student names (run once):
 *   npm run keys
 *
 * - PRIVATE key → <data folder>/keys/names-private.pem. Stays on this laptop;
 *   only it can read names (npm run pull). Back it up somewhere safe: if it
 *   is lost, encrypted names can never be read.
 * - PUBLIC key → NAMES_PUBLIC_KEY in .env.local; also set it on Vercel. It
 *   can only encrypt, so it is safe to share.
 *
 * Refuses to replace an existing private key (that would orphan any names
 * already encrypted with it) unless you pass --force.
 */
import { generateKeyPairSync } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function main() {
  const dir = path.join(process.env.LOG_DIR ? path.dirname(process.env.LOG_DIR) : path.join(os.homedir(), "bughunters-data"), "keys");
  const privPath = path.join(dir, "names-private.pem");
  if (existsSync(privPath) && !process.argv.includes("--force")) {
    console.log(`A private key already exists at ${privPath}. Not replacing it (use --force only if no data uses it).`);
    return;
  }
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  await mkdir(dir, { recursive: true });
  await writeFile(privPath, privateKey, { mode: 0o600 });
  const pub = Buffer.from(publicKey).toString("base64");

  const envPath = path.join(process.cwd(), ".env.local");
  let env = existsSync(envPath) ? await readFile(envPath, "utf8") : "";
  env = /^NAMES_PUBLIC_KEY=.*$/m.test(env) ? env.replace(/^NAMES_PUBLIC_KEY=.*$/m, `NAMES_PUBLIC_KEY=${pub}`) : `${env.trimEnd()}\n\n# Researcher's public key for student names (npm run keys).\nNAMES_PUBLIC_KEY=${pub}\n`;
  await writeFile(envPath, env);
  console.log(`Private key: ${privPath}  (keep it safe; back it up)\nPublic key: written to .env.local as NAMES_PUBLIC_KEY. Set the same value on Vercel.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

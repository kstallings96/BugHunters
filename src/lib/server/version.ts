import "server-only";
import { createHash } from "node:crypto";
import type { StudySettings } from "@/config/study";
import { MACHINES } from "@/machines";

/** "0.1.0+7b5675d", stamped at build time by next.config.ts. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * A short hash of the study settings and every machine's student-facing text
 * and fields. Two sessions with the same config_version saw the same game.
 */
export function configVersion(settings: StudySettings): string {
  const machines = Object.values(MACHINES).map(({ id, name, purpose, clientNote, fields, pseudocode }) => ({ id, name, purpose, clientNote, fields, pseudocode }));
  const material = JSON.stringify({ settings, machines });
  return createHash("sha256").update(material).digest("hex").slice(0, 10);
}

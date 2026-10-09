import "server-only";
import { createHash } from "node:crypto";
import { AVAILABLE_FORMS, type StudySettings } from "@/config/study";

/** "0.1.0+7b5675d", stamped at build time by next.config.ts. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * A short hash of everything that changes what a student sees without a code
 * change: study settings and (from stage 2) the form content. Two sessions
 * with the same config_version saw the same game.
 */
export function configVersion(settings: StudySettings): string {
  const material = JSON.stringify({ settings, forms: AVAILABLE_FORMS });
  return createHash("sha256").update(material).digest("hex").slice(0, 10);
}

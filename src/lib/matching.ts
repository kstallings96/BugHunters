import type { FormContent } from "@/content/types";

/**
 * A student's flag, as stored in game state and logged in flag_create.
 */
export interface Flag {
  id: number;
  /** "spot": tapped a place in the app. "something": the Something happened button. */
  kind: "spot" | "something";
  /** data-feature under the tap, or null. */
  feature: string | null;
  /** Tap position as % of the app frame (spot flags only). */
  x: number | null;
  y: number | null;
  reason: "mismatch" | "broken" | "dislike";
  /** Request item id for mismatch flags, or "other" for "something else". */
  requestItem: string | null;
  text: string;
  createdAt: string;
}

export type FlagMatch =
  | { kind: "glitch"; id: string; certain: boolean }
  | { kind: "red_herring"; id: string }
  | null;

/**
 * Auto-matches a flag to a glitch or red herring.
 *
 * - "Doesn't match" + a request item → the glitch (or requested red herring)
 *   tied to that item. Certain.
 * - "It's broken" → the broken glitch if it was flagged on one of its
 *   features or with Something happened. Not certain: these go to the
 *   researcher review queue (stage 5); the reveal still shows them as found.
 * - A flag on a red herring's feature that claims a problem → false alarm.
 * - "I just don't like it" never matches a glitch.
 */
export function matchFlag(flag: Flag, form: FormContent): FlagMatch {
  if (flag.reason === "mismatch" && flag.requestItem && flag.requestItem !== "other") {
    const glitch = form.glitches.find((g) => g.requestItem === flag.requestItem);
    if (glitch) return { kind: "glitch", id: glitch.id, certain: true };
    const herring = form.redHerrings.find((h) => h.requestItem === flag.requestItem);
    if (herring) return { kind: "red_herring", id: herring.id };
  }
  if (flag.reason === "broken") {
    const glitch = form.glitches.find(
      (g) => g.kind === "broken" && (flag.kind === "something" || (flag.feature !== null && g.features.includes(flag.feature))),
    );
    if (glitch) return { kind: "glitch", id: glitch.id, certain: false };
  }
  if (flag.reason !== "dislike" && flag.feature) {
    const herring = form.redHerrings.find((h) => h.features.includes(flag.feature!));
    if (herring) return { kind: "red_herring", id: herring.id };
  }
  return null;
}

export interface FlagSummary {
  found: string[];
  missed: string[];
  redHerringsFlagged: string[];
}

export function summarize(flags: Flag[], form: FormContent): FlagSummary {
  const found = new Set<string>();
  const herrings = new Set<string>();
  for (const f of flags) {
    const m = matchFlag(f, form);
    if (m?.kind === "glitch") found.add(m.id);
    if (m?.kind === "red_herring") herrings.add(m.id);
  }
  return {
    found: form.glitches.filter((g) => found.has(g.id)).map((g) => g.id),
    missed: form.glitches.filter((g) => !found.has(g.id)).map((g) => g.id),
    redHerringsFlagged: [...herrings],
  };
}

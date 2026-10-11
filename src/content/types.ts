import type { Form } from "@/lib/types";

/**
 * Everything a student reads in one form of the game. Both forms fill the
 * same slots (four glitches, two red herrings), so they stay parallel.
 * Components read from here; no game text lives in components.
 */

export interface RequestItem {
  id: string;
  icon: string;
  /** Short label shown next to the icon. */
  label: string;
}

export type GlitchKind = "visible" | "interaction" | "sequence" | "broken";

export interface Glitch {
  id: string;
  kind: GlitchKind;
  /** The request item it breaks; null for "it's broken" glitches. */
  requestItem: string | null;
  /** data-feature values where a flag on this glitch would land. */
  features: string[];
  /** Reveal: what the glitch was. */
  title: string;
  /** Reveal: one line on how to find it. */
  howToFind: string;
  /** Fix step: short name on the pick-a-glitch card. */
  shortName: string;
}

export interface RedHerring {
  id: string;
  kind: "requested" | "extra";
  requestItem: string | null;
  features: string[];
  title: string;
  /** Reveal: why it was not a glitch. */
  why: string;
}

export interface Feature {
  id: string;
  label: string;
  /** Counts toward coverage (something a student can tap or use). */
  interactive: boolean;
}

export interface FormContent {
  id: Form;
  client: { name: string; age: number; avatar: string };
  appName: string;
  /** The kid's request, word for word. */
  requestText: string;
  requestItems: RequestItem[];
  /** Step 1 line under the request. */
  glitchDefinition: string;
  card: { whenStarters: string[]; shouldStarters: string[] };
  glitches: Glitch[];
  redHerrings: RedHerring[];
  features: Feature[];
  checker: { answer: string; caught: string[] };
}

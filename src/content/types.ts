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
  /** The same request as the end of a test card: "it should ___". */
  should: string;
}

export type GlitchKind = "visible" | "interaction" | "sequence" | "broken";

export interface Glitch {
  id: string;
  kind: GlitchKind;
  /**
   * The request item it breaks. A card expecting this item fails. Null for
   * the "broken" glitch, which no chip targets (typed cards may find it).
   */
  requestItem: string | null;
  /** data-feature values where the glitch shows up. */
  features: string[];
  /** Reveal and feedback: what the glitch was. */
  title: string;
  /** Reveal and feedback: one line on how to see it. */
  howToFind: string;
  /** Fix step: short name on the pick-a-glitch card. */
  shortName: string;
  /** Reveal: a test card that would have caught it. */
  cardIdea: { when: string; should: string };
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
  /** "When I ___" chips for building a test card. */
  actions: string[];
  glitches: Glitch[];
  redHerrings: RedHerring[];
  features: Feature[];
  /**
   * The scripted AI checker. Asked "did this card pass?", it answers with
   * `verdicts[requestItem]` (default "pass") and the matching line. It is
   * confident and only right about the obvious glitch.
   */
  checker: {
    verdicts: Record<string, "pass" | "fail">;
    passText: string;
    failText: Record<string, string>;
  };
}

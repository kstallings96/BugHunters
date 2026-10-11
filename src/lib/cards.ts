import type { FormContent } from "@/content/types";

/**
 * Test cards: "When I ___, it should ___." A card whose expectation is one of
 * the client's request items can be judged automatically, because we know
 * whether the app meets that request. Typed expectations can't, and go to
 * the researcher review queue.
 */

export type Verdict = "pass" | "fail";

export interface TestCard {
  round: number;
  when: string;
  whenSource: "chip" | "typed";
  should: string;
  /** Request item behind the expectation chip, or null if typed. */
  shouldItem: string | null;
  verdict: Verdict | null;
  /** What the AI checker said for this card, if asked. */
  aiVerdict: Verdict | null;
}

export type Outcome =
  /** Said fail on a request the app breaks: found a glitch. */
  | "caught"
  /** Said pass on a request the app breaks. */
  | "missed"
  /** Said pass on a request the app meets. */
  | "confirmed"
  /** Said fail on a request the app meets. */
  | "false_alarm"
  /** Typed expectation: needs a person to judge. */
  | "unscored";

/** Whether the app actually meets this request item, and the glitch if not. */
export function truthFor(item: string | null, form: FormContent): { truth: Verdict | null; glitchId: string | null } {
  if (!item) return { truth: null, glitchId: null };
  const glitch = form.glitches.find((g) => g.requestItem === item);
  return glitch ? { truth: "fail", glitchId: glitch.id } : { truth: "pass", glitchId: null };
}

export function judge(card: Pick<TestCard, "shouldItem" | "verdict">, form: FormContent): { outcome: Outcome; truth: Verdict | null; glitchId: string | null } {
  const { truth, glitchId } = truthFor(card.shouldItem, form);
  if (!truth || !card.verdict) return { outcome: "unscored", truth, glitchId };
  if (truth === "fail") return { outcome: card.verdict === "fail" ? "caught" : "missed", truth, glitchId };
  return { outcome: card.verdict === "pass" ? "confirmed" : "false_alarm", truth, glitchId };
}

/** The scripted AI checker's answer for a card. */
export function aiVerdictFor(item: string | null, form: FormContent): { verdict: Verdict; text: string } {
  const verdict = (item && form.checker.verdicts[item]) || "pass";
  const text = verdict === "fail" ? (form.checker.failText[item!] ?? form.checker.passText) : form.checker.passText;
  return { verdict, text };
}

export interface CardSummary {
  /** Glitch ids caught by at least one card, in content order. */
  found: string[];
  missed: string[];
  /** Cards with an automatically checkable verdict that was right. */
  correct: number;
  scored: number;
  /** Times the AI checker gave a wrong verdict, among cards it was asked about. */
  aiWrong: number;
  aiAsked: number;
}

export function summarizeCards(cards: TestCard[], form: FormContent): CardSummary {
  const caught = new Set<string>();
  let correct = 0;
  let scored = 0;
  let aiWrong = 0;
  let aiAsked = 0;
  for (const c of cards) {
    const j = judge(c, form);
    if (j.outcome === "caught" && j.glitchId) caught.add(j.glitchId);
    if (j.outcome !== "unscored") {
      scored += 1;
      if (j.outcome === "caught" || j.outcome === "confirmed") correct += 1;
    }
    if (c.aiVerdict) {
      aiAsked += 1;
      if (j.truth && c.aiVerdict !== j.truth) aiWrong += 1;
    }
  }
  return {
    found: form.glitches.filter((g) => caught.has(g.id)).map((g) => g.id),
    missed: form.glitches.filter((g) => !caught.has(g.id)).map((g) => g.id),
    correct,
    scored,
    aiWrong,
    aiAsked,
  };
}

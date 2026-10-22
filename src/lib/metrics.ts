import { bugVisibility } from "@/machines";
import type { Category, MachineId } from "@/machines/types";

/**
 * Derived metrics, one row per session per measured app, computed from the
 * raw event log alone. Pure, so it can be re-run any time the definitions
 * change (and from either data store). Names match the spec and the exports.
 */

export interface MetricEvent {
  seq: number;
  client_ts: string;
  step: string;
  machine: string | null;
  event_type: string;
  payload: Record<string, unknown>;
}

export interface MetricSession {
  id: string;
  is_test: boolean;
  machine_order: MachineId[];
  reveal_condition: "reveal" | "end_only";
}

export interface MetricRow {
  session_id: string;
  is_test: boolean;
  reveal_condition: string;
  machine_order: string;
  machine: MachineId;
  /** 1, 2 or 3. */
  machine_position: number;
  coding_experience: number | null;
  ai_confidence: number | null;
  inputs_total: number;
  confirming_inputs: number;
  diagnostic_inputs: number;
  /** confirming ÷ diagnostic; null when there were no diagnostic inputs. */
  confirming_to_diagnostic_ratio: number | null;
  /** Milliseconds from entering the app to the first non-normal input. */
  time_to_first_diagnostic: number | null;
  distinct_categories: number;
  categories_tried: string;
  /** Inputs tried before "I'm done" / "Looks good" (null if never accepted). */
  inputs_before_done: number | null;
  /** Accepted the AI's claim with zero diagnostic inputs. */
  premature_acceptance: boolean | null;
  accepted_via: string | null;
  real_bugs: number;
  bug_kinds: string;
  false_alarm: number;
  debatable: number;
  /** Busted! on the app's vague refusal ("Invalid input"): refusing was right, the message is unhelpful. */
  unclear_message: number;
  /** Share of Busted! labels matching the classifier's (null if none to compare). */
  label_agreement: number | null;
  /** Share of "It should say" answers that were right (null if no Busted!). */
  expected_correct: number | null;
  /** Monster row only: categories used here that the student first used on a number app. */
  transfer_categories: string | null;
  transfer_count: number | null;
  nudge_shown: boolean;
  tries_used_up: boolean;
  /**
   * Loud vs silent bugs (see bugVisibility). "Seen": distinct bugs (kind ×
   * loud/silent) the app showed this student a wrong answer for. "Caught":
   * of those, how many they called Busted! on. Seen but not caught means the
   * wrong answer was on screen and went unnoticed.
   */
  loud_bugs_seen: number;
  loud_bugs_caught: number;
  silent_bugs_seen: number;
  silent_bugs_caught: number;
}

const isDiagnostic = (cats: Category[]) => !(cats.length === 1 && cats[0] === "normal");

export function computeMetrics(session: MetricSession, events: MetricEvent[]): MetricRow[] {
  const ev = [...events].sort((a, b) => a.seq - b.seq);
  const survey = (q: string) => {
    const e = ev.filter((x) => x.event_type === "survey_response" && x.payload.question === q).at(-1);
    return typeof e?.payload.choice === "number" ? e.payload.choice : null;
  };
  const coding = survey("coding_experience");
  const ai = survey("ai_confidence");

  const rows: MetricRow[] = [];
  const triedOnNumbers = new Set<string>();

  session.machine_order.forEach((machine, i) => {
    const mine = ev.filter((x) => x.machine === machine && x.step === "machine");
    const inputs = mine.filter((x) => x.event_type === "input_submit");
    const cats = inputs.map((x) => (x.payload.categories ?? []) as Category[]);
    const diagnostic = inputs.filter((_, k) => isDiagnostic(cats[k]));
    const enter = mine.find((x) => x.event_type === "step_enter");
    const accept = mine.find((x) => x.event_type === "accept_machine");
    const busts = mine.filter((x) => x.event_type === "busted");
    const tried = new Set(cats.flat().filter((c) => c !== "normal"));
    const realKinds = new Set(busts.filter((b) => b.payload.verdict === "real").map((b) => String(b.payload.bug_kind)));
    const agreements = busts.map((b) => b.payload.label_agreement).filter((v): v is boolean => typeof v === "boolean");
    const expectations = busts.map((b) => b.payload.expected_correct).filter((v): v is boolean => typeof v === "boolean");
    const firstDiag = diagnostic[0];

    // Loud vs silent: every (bug kind, visibility) the student was shown, and the ones they busted.
    const visibilityOfTry = new Map<number, "loud" | "silent">();
    const seen = { loud: new Set<string>(), silent: new Set<string>() };
    for (const x of inputs) {
      if (x.payload.reveals_bug !== true) continue;
      const v = bugVisibility(String(x.payload.output_shown ?? ""));
      visibilityOfTry.set(Number(x.payload.n), v);
      const kinds = (x.payload.bug_kinds as string[] | undefined) ?? (x.payload.bug_kind ? [String(x.payload.bug_kind)] : []);
      for (const k of kinds) seen[v].add(k);
    }
    const caught = { loud: new Set<string>(), silent: new Set<string>() };
    for (const b of busts) {
      if (b.payload.verdict !== "real") continue;
      const v = visibilityOfTry.get(Number(b.payload.input_n));
      if (v) caught[v].add(String(b.payload.bug_kind));
    }

    let transfer: string[] | null = null;
    if (machine === "monster") transfer = [...tried].filter((c) => triedOnNumbers.has(c)).sort();
    else for (const c of tried) triedOnNumbers.add(c);

    rows.push({
      session_id: session.id,
      is_test: session.is_test,
      reveal_condition: session.reveal_condition,
      machine_order: session.machine_order.join(">"),
      machine,
      machine_position: i + 1,
      coding_experience: coding,
      ai_confidence: ai,
      inputs_total: inputs.length,
      confirming_inputs: inputs.length - diagnostic.length,
      diagnostic_inputs: diagnostic.length,
      confirming_to_diagnostic_ratio: diagnostic.length ? (inputs.length - diagnostic.length) / diagnostic.length : null,
      time_to_first_diagnostic: firstDiag && enter ? Date.parse(firstDiag.client_ts) - Date.parse(enter.client_ts) : null,
      distinct_categories: tried.size,
      categories_tried: [...tried].sort().join("|"),
      inputs_before_done: accept ? inputs.filter((x) => x.seq < accept.seq).length : null,
      premature_acceptance: accept ? diagnostic.filter((x) => x.seq < accept.seq).length === 0 : null,
      accepted_via: accept ? String(accept.payload.via ?? "") : null,
      real_bugs: realKinds.size,
      bug_kinds: [...realKinds].sort().join("|"),
      false_alarm: busts.filter((b) => b.payload.verdict === "false_alarm").length,
      debatable: busts.filter((b) => b.payload.verdict === "debatable" && b.payload.unclear_message !== true).length,
      unclear_message: busts.filter((b) => b.payload.unclear_message === true).length,
      label_agreement: agreements.length ? agreements.filter(Boolean).length / agreements.length : null,
      expected_correct: expectations.length ? expectations.filter(Boolean).length / expectations.length : null,
      transfer_categories: transfer ? transfer.join("|") : null,
      transfer_count: transfer ? transfer.length : null,
      nudge_shown: mine.some((x) => x.event_type === "nudge_shown"),
      tries_used_up: mine.some((x) => x.event_type === "tries_used_up"),
      loud_bugs_seen: seen.loud.size,
      loud_bugs_caught: [...caught.loud].filter((k) => seen.loud.has(k)).length,
      silent_bugs_seen: seen.silent.size,
      silent_bugs_caught: [...caught.silent].filter((k) => seen.silent.has(k)).length,
    });
  });
  return rows;
}

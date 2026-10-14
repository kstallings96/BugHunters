import { describe, expect, it } from "vitest";
import { computeMetrics, type MetricEvent, type MetricSession } from "@/lib/metrics";

const session: MetricSession = { id: "s1", is_test: true, machine_order: ["savings", "sale", "monster"], reveal_condition: "reveal" };

let seq = 0;
const at = (s: number) => new Date(Date.UTC(2026, 9, 14, 15, 0, s)).toISOString();
function e(step: string, machine: string | null, event_type: string, payload: Record<string, unknown>, second: number): MetricEvent {
  return { seq: ++seq, client_ts: at(second), step, machine, event_type, payload };
}

const events: MetricEvent[] = [
  e("intake", null, "survey_response", { question: "coding_experience", choice: 2 }, 0),
  e("intake", null, "survey_response", { question: "ai_confidence", choice: 3 }, 1),
  // Savings: two normal inputs, then $0 a week (zero), bust it, accept.
  e("machine", "savings", "step_enter", {}, 10),
  e("machine", "savings", "input_submit", { categories: ["normal"] }, 12),
  e("machine", "savings", "input_submit", { categories: ["normal"] }, 14),
  e("machine", "savings", "input_submit", { categories: ["zero", "boundary"] }, 20),
  e("machine", "savings", "busted", { verdict: "real", bug_kind: "zero", label_agreement: true, expected_correct: false }, 22),
  e("machine", "savings", "busted", { verdict: "false_alarm", label_agreement: null, expected_correct: true }, 24),
  e("machine", "savings", "accept_machine", { via: "button" }, 30),
  // Sale: one normal input, then accept with no diagnostic input (premature).
  e("machine", "sale", "step_enter", {}, 40),
  e("machine", "sale", "input_submit", { categories: ["normal"] }, 41),
  e("machine", "sale", "nudge_shown", {}, 220),
  e("machine", "sale", "accept_machine", { via: "nudge" }, 221),
  // Monster: blank (tried before on savings? no) and a "special" + zero transfer.
  e("machine", "monster", "step_enter", {}, 230),
  e("machine", "monster", "input_submit", { categories: ["empty"] }, 235),
  e("machine", "monster", "input_submit", { categories: ["special"] }, 240),
  e("machine", "monster", "busted", { verdict: "real", bug_kind: "empty", label_agreement: false, expected_correct: true }, 241),
  e("machine", "monster", "accept_machine", { via: "button" }, 250),
];

describe("metrics", () => {
  const rows = computeMetrics(session, events);
  const [savings, sale, monster] = rows;

  it("one row per app, in order, with condition, order and intake on every row", () => {
    expect(rows.map((r) => [r.machine, r.machine_position])).toEqual([
      ["savings", 1],
      ["sale", 2],
      ["monster", 3],
    ]);
    for (const r of rows) expect(r).toMatchObject({ reveal_condition: "reveal", machine_order: "savings>sale>monster", coding_experience: 2, ai_confidence: 3 });
  });

  it("confirming vs diagnostic, time to first diagnostic, distinct categories", () => {
    expect(savings).toMatchObject({ inputs_total: 3, confirming_inputs: 2, diagnostic_inputs: 1, confirming_to_diagnostic_ratio: 2, time_to_first_diagnostic: 10_000 });
    expect(savings.categories_tried).toBe("boundary|zero");
    expect(sale).toMatchObject({ diagnostic_inputs: 0, confirming_to_diagnostic_ratio: null, time_to_first_diagnostic: null });
  });

  it("premature acceptance and inputs before done", () => {
    expect(savings).toMatchObject({ premature_acceptance: false, inputs_before_done: 3, accepted_via: "button" });
    expect(sale).toMatchObject({ premature_acceptance: true, inputs_before_done: 1, accepted_via: "nudge", nudge_shown: true });
  });

  it("bugs, false alarms, label agreement, right answers", () => {
    expect(savings).toMatchObject({ real_bugs: 1, bug_kinds: "zero", false_alarm: 1, label_agreement: 1, expected_correct: 0.5 });
    expect(monster).toMatchObject({ real_bugs: 1, label_agreement: 0 });
  });

  it("transfer: only on the monster row, categories first used on a number app", () => {
    expect(savings.transfer_categories).toBeNull();
    // Savings tried zero and boundary; the monster tried empty and special: no overlap.
    expect(monster).toMatchObject({ transfer_categories: "", transfer_count: 0 });
    const withOverlap = computeMetrics(session, [
      ...events,
      e("machine", "savings", "input_submit", { categories: ["empty"] }, 25),
    ]);
    expect(withOverlap[2]).toMatchObject({ transfer_categories: "empty", transfer_count: 1 });
  });
});

/**
 * Exports the data on this laptop to one Excel workbook, readable without a
 * codebook: a "Read me" tab explains every sheet and column in plain words.
 * The raw CSVs (for R, SPSS, Python) go in a raw/ folder beside it.
 *
 *   npm run pull                first, to bring the live site's data home
 *   npm run export              names left out (class period and nickname kept)
 *   npm run export -- --names   staff only: adds first name and last initial,
 *                               to join with the outside pre/post surveys
 *
 * Writes to <data folder>/exports/<timestamp>/, outside OneDrive and the repo.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { INTAKE } from "@/config/survey";
import { readStudySettings } from "@/config/study";
import { computeMetrics, type MetricEvent, type MetricRow } from "@/lib/metrics";
import { nicknameFor } from "@/lib/nickname";
import { defaultLogDir, type SessionRow, type StudentRow } from "@/lib/server/storage";
import { bugLabel, CATEGORY_LABEL, MACHINES, type Category, type MachineId } from "@/machines";

const withNames = process.argv.includes("--names");
const dir = process.env.LOG_DIR || defaultLogDir();
const timeZone = readStudySettings().timeZone;

type Event = MetricEvent & { server_ts: string };
type Row = Record<string, string | number | boolean | null>;

async function readAll<T>(kind: string): Promise<T[]> {
  try {
    const files = (await readdir(path.join(dir, kind))).filter((f) => f.endsWith(".json"));
    return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, kind, f), "utf8")) as T));
  } catch {
    return [];
  }
}

async function eventsOf(id: string): Promise<Event[]> {
  try {
    const text = await readFile(path.join(dir, "events", `${id}.jsonl`), "utf8");
    return text
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
      .sort((a, b) => a.seq - b.seq);
  } catch {
    return [];
  }
}

function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}

// ------------------------------------------------------------ plain words

/** "Oct 13, 2:05 PM" in the school's time zone. */
const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const appName = (id: string | null | undefined) =>
  id === "raffle" ? "Raffle Picker (bonus)" : id === "jersey" ? "Jersey Name Printer (old version)" : id && id in MACHINES ? MACHINES[id as MachineId].name : (id ?? "");

const kindName = (app: string | null | undefined, kind: unknown) =>
  typeof kind !== "string" || !kind ? "" : app && app in MACHINES ? bugLabel(app as MachineId, kind as Category) : (CATEGORY_LABEL[kind as Category] ?? kind);

const kindsName = (app: string | null | undefined, kinds: unknown) =>
  (Array.isArray(kinds) ? kinds : typeof kinds === "string" ? kinds.split("|") : [])
    .filter(Boolean)
    .map((k) => kindName(app, k))
    .join(", ");

/** What the student typed: `Price: 20 · Saved per week: 0` (blank shown as "(empty)"). */
function typed(app: string | null | undefined, inputs: unknown): string {
  if (!inputs || typeof inputs !== "object") return "";
  const values = inputs as Record<string, string>;
  const fields = app && app in MACHINES ? MACHINES[app as MachineId].fields : Object.keys(values).map((id) => ({ id, label: id }));
  const show = (v: string | undefined) => (v === undefined ? "" : v === "" ? "(empty)" : v.replace(/\n/g, " / "));
  if (fields.length === 1) return show(values[fields[0].id]);
  return fields.map((f) => `${f.label.replace(/\s*\(.*\)$/, "")}: ${show(values[f.id])}`).join(" · ");
}

const STUDENT_LABEL_TEXT: Record<string, string> = {
  zero: "Zero",
  blank: "Blank",
  negative: "Negative",
  too_big: "Too big / Too long",
  exact_limit: "Exactly the limit",
  not_a_number: "Not a number",
  has_numbers: "Has numbers",
  symbols: "Symbols or emoji",
  something_else: "Something else",
  wrong_kind: "Wrong kind (old label)",
};

const VERDICT: Record<string, string> = { real: "Real bug", false_alarm: "Not a bug", debatable: "Debatable" };

const intakeText = (q: "coding_experience" | "ai_confidence", n: number | null) => {
  if (n === null) return "";
  const choice = INTAKE.find((i) => i.id === q)?.choices[n - 1];
  return choice ? `${n} = ${choice.label}` : String(n);
};

const yes = (v: unknown) => (v === true ? "Yes" : v === false ? "No" : "");
const pct = (v: number | null) => (v === null ? "" : Math.round(v * 100));

// ------------------------------------------------------------ the sheets

/** Sheet, column, meaning: shown on the Read me tab. */
const DICTIONARY: [string, string, string][] = [];
function describe(sheet: string, columns: [string, string][]) {
  for (const [c, m] of columns) DICTIONARY.push([sheet, c, m]);
}

const WHO: [string, string][] = [
  ...(withNames
    ? ([
        ["First name", "As the student typed it at login."],
        ["Last initial", "As typed at login."],
      ] as [string, string][])
    : []),
  ["Period", "Class period picked at login."],
  ["Nickname", "The bug-hunter nickname shown on screen and on the leaderboard (made from the session, never the name)."],
  ["Test login", 'Yes if the first name started with "Test" (or the link had ?test=1). Filter these out for analysis.'],
];

describe("Students", [
  ...WHO,
  ["Started", "When the session began (school time zone)."],
  ["Finished", 'When they tapped "I\'m finished". Blank if they never did (closed the tab, ran out of time).'],
  ["Minutes", "From start to finish (or to their last event, if they never finished)."],
  ["Reveal group", '"After each app": saw what they missed after every app. "Only at the end": saw it once, after the last app. Assigned at random.'],
  ["App order", "Which number app came first (random). The Monster Namer is always third."],
  ["Coding experience", "Intake question 1, 1 (Never) to 5 (A lot)."],
  ["AI confidence", "Intake question 2, 1 (Not at all) to 5 (Very confident)."],
  ["Bugs busted (3 apps)", "Different bugs found in the three apps (each kind counts once per app). The leaderboard score."],
  ["Bug kinds found", "Which kinds, by app."],
  ["Bonus bugs", "Bugs found in the bonus Raffle Picker (not part of the study measures)."],
  ["Code questions", "Bonus code questions answered, and how many were fully right (found the line AND picked the fix)."],
  ["Session ID", "Joins this row to the other sheets and the raw files."],
]);

describe("Per app", [
  ...WHO,
  ["App", "Savings Planner, Sale Price or Monster Namer."],
  ["Position", "1st, 2nd or 3rd app this student saw."],
  ["Reveal group", "As on Students."],
  ["Tries", 'Inputs tried ("Try it" taps), up to 8.'],
  ["Ordinary tries", "Tries with only everyday inputs (like 20 and 5). These confirm the app works but can't find bugs."],
  ["Edge-case tries", "Tries with at least one unusual input: zero, blank, negative, too big, not a number, symbols, the limit..."],
  ["Ordinary per edge case", "Ordinary tries ÷ edge-case tries. Lower means more deliberate testing. Blank if no edge cases."],
  ["Seconds to first edge case", "Time from opening the app to the first edge-case try."],
  ["Input kinds tried", "How many different kinds of input they tried, and which."],
  ["Tries before moving on", 'Tries before "Looks good, next" (or the nudge).'],
  ["Moved on with no edge cases", "Yes if they accepted the AI's claim without trying a single unusual input."],
  ["Moved on by", '"Button" (Looks good) or "Nudge" (the "Ready for the next machine?" prompt after 3 minutes). Blank if they never moved on.'],
  ["Bugs busted", "Different real bugs found in this app, and which kinds."],
  ["False alarms", "Busted! on an input the app handled correctly."],
  ["Debatable", 'Busted! on an input the request doesn\'t cover (like "$20" or a hyphenated name).'],
  ["Labels right %", '"What kind of input broke it?" answers that named a bug the input really showed.'],
  ['"It should say" right %', '"It should say…" answers that picked the correct output.'],
  ["Kinds reused (Monster only)", "Input kinds tried on the Monster Namer that they had first tried on a number app: does the testing transfer to text?"],
  ["Saw nudge", 'Yes if "Ready for the next machine?" appeared (3 minutes in). It never moves them on by itself.'],
  ["Used all 8 tries", "Yes if they ran out of tries on this app."],
]);

describe("Tries", [
  ...WHO,
  ["App", "Which app (Practice = the Allowance Doubler tutorial)."],
  ["Try #", "1 to 8, in order."],
  ["Typed", "Exactly what the student typed in each box."],
  ["App showed", "What the AI's app answered."],
  ["Should say", "What a correct app would answer (from the request)."],
  ["Input kinds", "How the input is classified: Normal, Zero, Blank, Negative, Too big, Not a number, Symbols..."],
  ["Bug?", '"Bug" if the app got it wrong, "Debatable" if the request doesn\'t say, otherwise blank.'],
  ["Bug kinds", "Which bug(s) this input shows (an input can show two, like a long name with numbers)."],
]);

describe("Busted", [
  ...WHO,
  ["App", "Which app."],
  ["Try #", "Which try the student called Busted! on."],
  ["Typed", "That try's input."],
  ["App showed", "What the app answered."],
  ['"It should say" pick', "What the student said the right answer was (or I'm not sure)."],
  ['"It should say" right', "Yes if they picked the correct answer."],
  ["Kind they picked", '"What kind of input broke it?" answer.'],
  ["Kind right", "Yes if it names a bug this input really shows."],
  ["Verdict", '"Real bug", "Not a bug" (false alarm) or "Debatable".'],
  ["Bug credited", "Which bug got credit."],
  ["Counted", "Yes if it added to their score (not a kind they had already found on this app)."],
  ["Raffle: tapped", "Bonus only: the part of the result the student tapped."],
  ["Raffle: their words", "Bonus only: what they typed about what's wrong (as typed; may need a check for language)."],
]);

describe("Code questions", [
  ...WHO,
  ["App", "The app the bug was in."],
  ["Bug", "Which bug the question was about."],
  ["Question type", '"A line is wrong" or "A check is missing".'],
  ["Found it", "Part 1: did they pick the right line (or spot that a check was missing)?"],
  ["Their fix", "Part 2: the fix they picked."],
  ["Fix right", "Yes if it was the fix that works for every input (three choices are near misses)."],
]);

describe("raw/ folder", [
  ["sessions.csv", "One row per session: every stored field."],
  ["events.csv", "Every logged event in order; payload is the event's details as JSON."],
  ["metrics.csv", "The Per app sheet with code-style column names, for stats software."],
]);

function addSheet(wb: ExcelJS.Workbook, name: string, rows: Row[], widths: Record<string, number> = {}) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  const cols = rows.length ? Object.keys(rows[0]) : DICTIONARY.filter(([s]) => s === name).map(([, c]) => c);
  ws.columns = cols.map((c) => ({ header: c, key: c, width: widths[c] ?? Math.min(40, Math.max(12, c.length + 2)) }));
  for (const r of rows) ws.addRow(r);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE68A" } };
  ws.getRow(1).alignment = { wrapText: true, vertical: "top" };
  if (cols.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}

// ------------------------------------------------------------------ main

async function main() {
  const students = new Map((await readAll<StudentRow>("students")).map((s) => [s.id, s]));
  const sessions = (await readAll<SessionRow>("sessions")).filter((s) => Array.isArray(s.machine_order) && s.reveal_condition);
  // Real students first, then test logins; oldest first within each.
  sessions.sort((a, b) => Number(a.is_test) - Number(b.is_test) || a.started_at.localeCompare(b.started_at));

  const who = (s: SessionRow): Row => {
    const st = students.get(s.student_id);
    return {
      ...(withNames ? { "First name": st?.first_name ?? "", "Last initial": st?.last_initial ?? "" } : {}),
      Period: st?.class_period ?? "",
      Nickname: nicknameFor(s.id),
      "Test login": yes(s.is_test),
    };
  };

  const studentRows: Row[] = [];
  const appRows: Row[] = [];
  const tryRows: Row[] = [];
  const bustRows: Row[] = [];
  const codeRows: Row[] = [];
  const rawSessions: Record<string, unknown>[] = [];
  const rawEvents: Record<string, unknown>[] = [];
  const rawMetrics: Record<string, unknown>[] = [];

  for (const s of sessions) {
    const ev = await eventsOf(s.id);
    const metrics: MetricRow[] = computeMetrics(s, ev);
    const reveal = s.reveal_condition === "reveal" ? "After each app" : "Only at the end";
    const last = ev.at(-1)?.client_ts ?? s.started_at;
    const end = s.ended_at ?? ev.find((e) => e.event_type === "session_end")?.client_ts ?? null;
    const minutes = Math.round((Date.parse(end ?? last) - Date.parse(s.started_at)) / 6000) / 10;
    const busts = ev.filter((e) => e.event_type === "busted");
    const counted = busts.filter((b) => b.payload.counted === true);
    const measured = counted.filter((b) => b.step === "machine");
    const codes = ev.filter((e) => e.event_type === "guilty_line_attempt");

    studentRows.push({
      ...who(s),
      Started: when(s.started_at),
      Finished: when(end),
      Minutes: minutes,
      "Reveal group": reveal,
      "App order": s.machine_order.map(appName).join(" → "),
      "Coding experience": intakeText("coding_experience", metrics[0]?.coding_experience ?? null),
      "AI confidence": intakeText("ai_confidence", metrics[0]?.ai_confidence ?? null),
      "Bugs busted (3 apps)": measured.length,
      "Bug kinds found": metrics
        .filter((m) => m.real_bugs)
        .map((m) => `${appName(m.machine)}: ${kindsName(m.machine, m.bug_kinds)}`)
        .join("; "),
      "Bonus bugs": counted.filter((b) => b.machine === "raffle").length,
      "Code questions": codes.length ? `${codes.filter((c) => c.payload.correct === true).length} right of ${codes.length}` : "",
      "Session ID": s.id,
    });

    for (const m of metrics) {
      appRows.push({
        ...who(s),
        App: appName(m.machine),
        Position: m.machine_position,
        "Reveal group": reveal,
        Tries: m.inputs_total,
        "Ordinary tries": m.confirming_inputs,
        "Edge-case tries": m.diagnostic_inputs,
        "Ordinary per edge case": m.confirming_to_diagnostic_ratio === null ? "" : Math.round(m.confirming_to_diagnostic_ratio * 100) / 100,
        "Seconds to first edge case": m.time_to_first_diagnostic === null ? "" : Math.round(m.time_to_first_diagnostic / 1000),
        "Input kinds tried": m.distinct_categories,
        "Which input kinds": kindsName(m.machine, m.categories_tried),
        "Tries before moving on": m.inputs_before_done ?? "",
        "Moved on with no edge cases": yes(m.premature_acceptance),
        "Moved on by": m.accepted_via === "button" ? "Button" : m.accepted_via === "nudge" ? "Nudge" : "",
        "Bugs busted": m.real_bugs,
        "Which bugs": kindsName(m.machine, m.bug_kinds),
        "False alarms": m.false_alarm,
        Debatable: m.debatable,
        "Labels right %": pct(m.label_agreement),
        '"It should say" right %': pct(m.expected_correct),
        "Kinds reused (Monster only)": m.transfer_categories === null ? "" : `${m.transfer_count}: ${kindsName(m.machine, m.transfer_categories)}`,
        "Saw nudge": yes(m.nudge_shown),
        "Used all 8 tries": yes(m.tries_used_up),
        "Session ID": s.id,
      });
      rawMetrics.push({ ...m, student_id: s.student_id, ...(withNames ? { first_name: students.get(s.student_id)?.first_name, last_initial: students.get(s.student_id)?.last_initial } : {}), class_period: students.get(s.student_id)?.class_period ?? "" });
    }

    for (const e of ev) {
      const p = e.payload;
      const app = e.machine;
      const appLabel = e.step === "tutorial" ? "Practice (Allowance Doubler)" : appName(app);
      if (e.event_type === "input_submit") {
        const kinds = (p.bug_kinds as string[] | undefined) ?? (p.bug_kind ? [p.bug_kind as string] : []);
        tryRows.push({
          ...who(s),
          App: appLabel,
          "Try #": (p.n as number) ?? "",
          Typed: typed(app, p.inputs),
          "App showed": app === "raffle" ? ((p.winners as string[] | undefined) ?? []).join(", ") : String(p.output_shown ?? ""),
          "Should say": String(p.reference_output ?? ""),
          "Input kinds": kindsName(app, p.categories),
          "Bug?": p.reveals_bug ? "Bug" : p.debatable ? "Debatable" : "",
          "Bug kinds": kindsName(app, kinds),
          "Session ID": s.id,
        });
      } else if (e.event_type === "busted") {
        const tap = p.tap as { type: string; name?: string } | undefined;
        bustRows.push({
          ...who(s),
          App: appLabel,
          "Try #": (p.input_n as number) ?? "",
          Typed: typed(app, p.inputs),
          "App showed": String(p.output_shown ?? ""),
          '"It should say" pick': p.expected_unsure ? "I'm not sure" : String(p.expected_choice ?? ""),
          '"It should say" right': yes(p.expected_correct),
          "Kind they picked": STUDENT_LABEL_TEXT[String(p.student_label)] ?? String(p.student_label ?? ""),
          "Kind right": yes(p.label_agreement),
          Verdict: VERDICT[String(p.verdict)] ?? String(p.verdict ?? ""),
          "Bug credited": kindName(app, p.bug_kind),
          Counted: yes(p.counted),
          "Raffle: tapped": tap ? (tap.type === "row" ? `${tap.name}'s bar` : "the winner") : "",
          "Raffle: their words": String(p.explanation ?? ""),
          "Session ID": s.id,
        });
      } else if (e.event_type === "guilty_line_attempt") {
        const fixed = p.fix_choice_text ?? p.chosen_text;
        codeRows.push({
          ...who(s),
          App: appName(p.bug_machine as string),
          Bug: kindName(p.bug_machine as string, p.bug_kind),
          "Question type": p.question === "wrong_line" ? "A line is wrong" : "A check is missing",
          "Found it": yes(p.find_correct),
          "Their fix": String(fixed ?? ""),
          "Fix right": yes(p.fix_correct ?? p.correct),
          "Session ID": s.id,
        });
      }
      rawEvents.push({ session_id: s.id, is_test: s.is_test, seq: e.seq, client_ts: e.client_ts, server_ts: e.server_ts, step: e.step, machine: e.machine, event_type: e.event_type, payload: e.payload });
    }

    const st = students.get(s.student_id);
    rawSessions.push({
      session_id: s.id,
      student_id: s.student_id,
      ...(withNames ? { first_name: st?.first_name ?? "", last_initial: st?.last_initial ?? "" } : {}),
      class_period: st?.class_period ?? "",
      nickname: nicknameFor(s.id),
      is_test: s.is_test,
      reveal_condition: s.reveal_condition,
      machine_order: s.machine_order.join(">"),
      order_assignment: s.order_assignment,
      reveal_assignment: s.reveal_assignment,
      app_version: s.app_version,
      started_at: s.started_at,
      ended_at: s.ended_at,
      user_agent: s.user_agent,
      screen: `${s.screen_width}x${s.screen_height}`,
      events: ev.length,
    });
  }

  // ---------------------------------------------------------- workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "bugHunters export";
  const readme = wb.addWorksheet("Read me");
  readme.columns = [
    { key: "a", width: 26 },
    { key: "b", width: 34 },
    { key: "c", width: 110 },
  ];
  const real = sessions.filter((s) => !s.is_test).length;
  const lines: string[][] = [
    ["bugHunters data export"],
    ["Exported", when(new Date().toISOString())],
    ["From", `${dir} (this laptop). Run npm run pull first to bring in the live site's data.`],
    ["Sessions", `${sessions.length} in all: ${real} real, ${sessions.length - real} test logins (Test login = Yes). Real ones are listed first.`],
    [
      "Names",
      withNames
        ? "INCLUDED. Staff only: keep this file off shared drives and email."
        : "Not included (the default, for privacy). To add first name and last initial, run: npm run export -- --names",
    ],
    [],
    ["Sheet", "What one row is"],
    ["Students", "One student session: who, when, condition, intake answers, bugs found."],
    ["Per app", "One student × one of the three apps: how they tested it. The study measures."],
    ["Tries", "Every input a student tried, what the app showed, and what it should have shown."],
    ["Busted", "Every time a student called Busted!, what they said, and how it was scored."],
    ["Code questions", "Bonus code questions (not part of the study measures)."],
    ["raw/ folder", "The same data as CSV files for stats software."],
    [],
    ["Sheet", "Column", "What it means"],
    ...DICTIONARY.map(([a, b, c]) => [a, b, c]),
  ];
  for (const l of lines) readme.addRow(l);
  readme.getRow(1).font = { bold: true, size: 16 };
  for (const r of [7, 15]) readme.getRow(r).font = { bold: true };
  readme.getColumn(3).alignment = { wrapText: true, vertical: "top" };

  addSheet(wb, "Students", studentRows, { "Bug kinds found": 50, "App order": 44, "Session ID": 38, Started: 16, Finished: 16 });
  addSheet(wb, "Per app", appRows, { "Which input kinds": 40, "Which bugs": 36, "Kinds reused (Monster only)": 30, "Session ID": 38 });
  addSheet(wb, "Tries", tryRows, { Typed: 34, "App showed": 30, "Should say": 34, "Input kinds": 28, "Bug kinds": 28, "Session ID": 38 });
  addSheet(wb, "Busted", bustRows, { Typed: 30, "App showed": 26, '"It should say" pick': 34, "Raffle: their words": 40, "Session ID": 38 });
  addSheet(wb, "Code questions", codeRows, { "Their fix": 70, "Session ID": 38 });

  const out = path.join(dir, "exports", new Date().toISOString().replace(/[:.]/g, "-") + (withNames ? "-with-names" : ""));
  await mkdir(path.join(out, "raw"), { recursive: true });
  const file = path.join(out, withNames ? "bughunters-with-names.xlsx" : "bughunters.xlsx");
  await wb.xlsx.writeFile(file);
  await writeFile(path.join(out, "raw", "sessions.csv"), csv(rawSessions));
  await writeFile(path.join(out, "raw", "events.csv"), csv(rawEvents));
  await writeFile(path.join(out, "raw", "metrics.csv"), csv(rawMetrics));
  console.log(`${sessions.length} sessions (${real} real, ${sessions.length - real} test) → ${file}${withNames ? "\n  INCLUDES NAMES: staff only" : "\n  Names left out. Add them with: npm run export -- --names"}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

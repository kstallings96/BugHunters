/**
 * Generation script: has a real model write each app, then measures which
 * bugs it wrote. Runs on a researcher's machine only, never in the deployed
 * app. The API key is read from .env.local and never logged.
 *
 *   npm run gen -- selftest                      check the harness on the hand-written apps
 *   npm run gen -- generate [--n 15] [--only savings]
 *   npm run gen -- harness generation/runs/<run> frequency table for a run
 *
 * Every run folder records provider, model (as the API reported it), date,
 * settings and every prompt verbatim, for the methods section.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buggyPick, entriesOf } from "@/bonus/raffle";
import { findBugs, GEN_SPECS, loadFunction, RAFFLE_GEN, raffleBugs, type Finding } from "@/generation/harness";
import { testsPrompt, type GenSpec } from "@/generation/specs";
import { MACHINES } from "@/machines";

const MODEL = process.env.GEN_MODEL || "google/gemini-3.1-flash-lite";
const SETTINGS = { temperature: Number(process.env.GEN_TEMPERATURE ?? 1), max_tokens: 2000, reasoning: { effort: process.env.GEN_REASONING || "low" } };
const OUT = path.join(process.cwd(), "generation");

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function chat(prompt: string): Promise<{ text: string; model: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Set OPENROUTER_API_KEY in .env.local first.");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "bugHunters generation" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: prompt }], ...SETTINGS }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return { text: data.choices?.[0]?.message?.content ?? "", model: data.model ?? MODEL };
}

function extractCode(text: string): string {
  const m = text.match(/```(?:js|javascript)?\s*\n([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
}

function extractJson(text: string): unknown {
  const m = text.match(/\[[\s\S]*\]/);
  try {
    return m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ generate

async function generate() {
  const n = Number(flag("n") ?? 15);
  const only = flag("only");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(OUT, "runs", stamp);
  const targets: { id: string; prompt: string; functionName: string; params: string[] }[] = [
    ...GEN_SPECS.map((s) => ({ id: s.machine, prompt: `${s.kidPrompt}\n\n${s.format}`, functionName: s.functionName, params: s.params })),
    { id: "raffle", prompt: `${RAFFLE_GEN.kidPrompt}\n\n${RAFFLE_GEN.format}`, functionName: RAFFLE_GEN.functionName, params: ["namesText"] },
  ].filter((t) => !only || t.id === only);

  const meta = { provider: "OpenRouter", requested_model: MODEL, reported_models: new Set<string>(), date: new Date().toISOString(), settings: SETTINGS, samples_per_machine: n, prompts: {} as Record<string, unknown> };
  for (const t of targets) {
    const dir = path.join(runDir, t.id);
    await mkdir(dir, { recursive: true });
    meta.prompts[t.id] = { build: t.prompt, tests: testsPrompt("<the sample's code>", t.functionName, t.params) };
    for (let i = 1; i <= n; i++) {
      const tag = String(i).padStart(2, "0");
      process.stdout.write(`${t.id} ${tag}/${n} `);
      const built = await chat(t.prompt);
      meta.reported_models.add(built.model);
      const code = extractCode(built.text);
      await writeFile(path.join(dir, `sample-${tag}.raw.txt`), built.text);
      await writeFile(path.join(dir, `sample-${tag}.js`), code + "\n");
      const tests = await chat(testsPrompt(code, t.functionName, t.params));
      await writeFile(path.join(dir, `sample-${tag}.tests.json`), JSON.stringify(extractJson(tests.text) ?? { unparsed: tests.text }, null, 2));
      console.log("ok");
    }
  }
  await writeFile(path.join(runDir, "meta.json"), JSON.stringify({ ...meta, reported_models: [...meta.reported_models] }, null, 2));
  console.log(`\nSaved to ${path.relative(process.cwd(), runDir)}. Next: npm run gen -- harness ${path.relative(process.cwd(), runDir)}`);
}

// ------------------------------------------------------------------- harness

type Row = { sample: string; bugs: string[]; findings: Finding[] | string[] };

async function harness(runDir: string) {
  const report: Record<string, Row[]> = {};
  for (const spec of GEN_SPECS) {
    const dir = path.join(runDir, spec.machine);
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((f) => /^sample-\d+\.js$/.test(f)).sort();
    } catch {
      continue;
    }
    report[spec.machine] = [];
    for (const f of files) {
      const code = await readFile(path.join(dir, f), "utf8");
      try {
        const findings = findBugs(spec, loadFunction(code, spec.functionName));
        report[spec.machine].push({ sample: f, bugs: [...new Set(findings.map((x) => String(x.bug)))], findings });
      } catch (e) {
        report[spec.machine].push({ sample: f, bugs: ["unusable"], findings: [(e as Error).message] });
      }
    }
  }
  const raffleDir = path.join(runDir, "raffle");
  try {
    const files = (await readdir(raffleDir)).filter((f) => /^sample-\d+\.js$/.test(f)).sort();
    report.raffle = [];
    for (const f of files) {
      try {
        const r = raffleBugs(loadFunction(await readFile(path.join(raffleDir, f), "utf8"), RAFFLE_GEN.functionName));
        const bugs = Object.entries(r).filter(([k, v]) => k !== "notes" && v === true).map(([k]) => k);
        report.raffle.push({ sample: f, bugs, findings: r.notes });
      } catch (e) {
        report.raffle.push({ sample: f, bugs: ["unusable"], findings: [(e as Error).message] });
      }
    }
  } catch {}

  await writeFile(path.join(runDir, "report.json"), JSON.stringify(report, null, 2));
  const md = toMarkdown(report);
  await writeFile(path.join(runDir, "report.md"), md);
  console.log(md);
}

function toMarkdown(report: Record<string, Row[]>): string {
  const lines = ["# Bugs in generated samples", ""];
  for (const [machine, rows] of Object.entries(report)) {
    const counts = new Map<string, number>();
    for (const r of rows) for (const b of r.bugs) counts.set(b, (counts.get(b) ?? 0) + 1);
    lines.push(`## ${machine} (${rows.length} samples)`, "", "| Bug kind | Samples with it |", "|---|---|");
    for (const [b, c] of [...counts].sort((a, z) => z[1] - a[1])) lines.push(`| ${b} | ${c} of ${rows.length} |`);
    if (!counts.size) lines.push("| (none found) | |");
    lines.push("", "Per sample: " + rows.map((r) => `${r.sample.replace(/\.js$/, "")} [${r.bugs.join(", ") || "none"}]`).join("; "), "");
  }
  return lines.join("\n");
}

// ------------------------------------------------------------------ selftest

/** The harness must find every planted bug in the hand-written apps. */
async function selftest() {
  let ok = true;
  for (const spec of GEN_SPECS) {
    const machine = MACHINES[spec.machine];
    const fn = (...a: string[]) => machine.buggy(Object.fromEntries(spec.params.map((p, i) => [p, a[i]])), { today: new Date() }).text;
    const found = new Set(findBugs(spec as GenSpec, fn).map((f) => f.bug));
    const planted = machine.bugs.map((b) => b.kind);
    const missing = planted.filter((k) => !found.has(k));
    console.log(`${spec.machine}: found [${[...found].join(", ")}]${missing.length ? `  MISSING [${missing.join(", ")}]` : ""}`);
    if (missing.length) ok = false;
    // And no false positives: the correct version must come out clean.
    const ref = (...a: string[]) => machine.reference(Object.fromEntries(spec.params.map((p, i) => [p, a[i]])), { today: new Date() }).text;
    const wrongly = findBugs(spec as GenSpec, ref);
    if (wrongly.length) {
      ok = false;
      console.log(`  FALSE POSITIVES on the reference: ${JSON.stringify(wrongly.map((w) => w.inputs))}`);
    }
  }
  const r = raffleBugs((text: string) => buggyPick(entriesOf(text)));
  console.log(`raffle: ${JSON.stringify(r)}`);
  if (!r.lastNeverWins || !r.blankCanWin || !r.emptyGivesJunk || !r.oneNameWins) ok = false;
  const fair = raffleBugs((text: string) => {
    const names = text.split("\n").map((s) => s.trim()).filter(Boolean);
    if (names.length < 2) return "Add at least 2 names.";
    return names[Math.floor(Math.random() * names.length)];
  });
  if (fair.lastNeverWins || fair.blankCanWin || fair.emptyGivesJunk || fair.oneNameWins) {
    ok = false;
    console.log(`  FALSE POSITIVES on a fair raffle: ${JSON.stringify(fair)}`);
  }
  console.log(ok ? "\nSelf-test passed: the harness finds every planted bug." : "\nSelf-test FAILED.");
  process.exitCode = ok ? 0 : 1;
}

async function main() {
  const cmd = args[0];
  if (cmd === "generate") await generate();
  else if (cmd === "harness" && args[1]) await harness(args[1]);
  else if (cmd === "selftest") await selftest();
  else console.log("Usage: npm run gen -- selftest | generate [--n 15] [--only <machine>] | harness <run folder>");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

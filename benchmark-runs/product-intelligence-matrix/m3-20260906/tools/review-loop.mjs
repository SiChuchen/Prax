#!/usr/bin/env node
/**
 * M3 Task 6 — blind reviewer loop. One fresh, independent claude session per
 * (reviewer, package); cwd is the blind package itself; zero MCP; no access to
 * the private mapping or the other reviewer's scores (scores are written by
 * this operator script outside the package tree). Idempotent: skips packages
 * whose score file already exists. Window guard: no new session after the
 * given local cutoff (HH:MM).
 *
 *   node review-loop.mjs <R1|R2> [cutoffHH:MM]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, cpSync } from "node:fs";

const [reviewer, cutoff = "08:20"] = process.argv.slice(2);
if (!/^R[12]$/.test(reviewer)) { console.error("usage: review-loop.mjs <R1|R2> [cutoffHH:MM]"); process.exit(2); }
const OP = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-20260906";
const scoresDir = `${OP}/review/scores/${reviewer}`;
mkdirSync(scoresDir, { recursive: true });
const opEv = (obj) => appendFileSync(`${OP}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");
const rubric = readFileSync(`${OP}/review/rubric.md`, "utf8");
const [cH, cM] = cutoff.split(":").map(Number);
const pastCutoff = () => { const d = new Date(); const m = d.getHours() * 60 + d.getMinutes(); return m >= cH * 60 + cM && m < 23 * 60; };

for (let i = 1; i <= 20; i++) {
  const id = `impl-${String(i).padStart(2, "0")}`;
  const scorePath = `${scoresDir}/${id}.json`;
  if (existsSync(scorePath)) continue;
  if (pastCutoff()) { console.log(`${reviewer}: cutoff ${cutoff} reached before ${id}; stopping`); opEv({ kind: "review_cutoff", reviewer, next: id }); break; }
  const pkgDir = `${OP}/review/blind/${id}`;
  cpSync(`${OP}/review/rubric.md`, `${pkgDir}/rubric.md`);
  const prompt = `You are ${reviewer}, an independent blind reviewer for a UI implementation benchmark. Work ONLY inside the current directory (the anonymous package ${id}). Do not read anything outside it and do not speculate about how or by whom it was built.

Steps:
1. Read rubric.md (scoring contract) and brief.md (the task the implementation had to satisfy).
2. View BOTH screenshots: screenshots/1280x860.png and screenshots/1440x900.png (use the Read tool on each PNG).
3. Read measurement-summary.json (seven browser checks; sanitized).
4. Read the product source under source/ (at least the entry HTML, main script(s), and styles).
5. Score every rubric dimension 1-5 with a concrete evidence citation (viewport, file:line, or check id); use null + missing_evidence when you cannot see it. Mark task_completion_time, information_retrieval_accuracy, human_preference as not_observable.

Output ONLY the JSON object specified in rubric.md (no prose before or after, no markdown fences). package_id must be "${id}".`;
  const started = Date.now();
  const r = spawnSync(process.env.ComSpec || "cmd.exe", [
    "/d", "/s", "/c", "claude", "--print",
    "--strict-mcp-config", "--mcp-config", `${OP}/launch/mcp-config-empty.json`,
    "--model", "sonnet", "--dangerously-skip-permissions", "--max-turns", "40",
    "--output-format", "json",
  ], { cwd: pkgDir, input: prompt, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60_000 });
  const secs = Math.round((Date.now() - started) / 1000);
  let parsed = null, raw = null, sessionId = null, usage = null;
  try {
    const env = JSON.parse(r.stdout);
    raw = env.result ?? ""; sessionId = env.session_id ?? null; usage = env.modelUsage ?? env.usage ?? null;
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    if (a !== -1 && b > a) parsed = JSON.parse(raw.slice(a, b + 1));
  } catch { /* fall through */ }
  const record = {
    reviewer, package_id: id, session_id: sessionId, wall_clock_seconds: secs, cli_exit_code: r.status,
    parsed_ok: parsed !== null && parsed.package_id === id,
    scores: parsed, raw_result_text: parsed === null ? (raw ?? (r.stdout || "").slice(-2000)) : undefined,
    usage, stderr_tail: (r.stderr || "").slice(-300), recorded_at: new Date().toISOString(),
  };
  writeFileSync(scorePath, JSON.stringify(record, null, 2));
  opEv({ kind: "review_scored", reviewer, package_id: id, parsed_ok: record.parsed_ok, wall_clock_seconds: secs, session_id: sessionId });
  console.log(`${reviewer} ${id}: parsed_ok=${record.parsed_ok} ${secs}s session=${sessionId}`);
}
console.log(`${reviewer}: loop finished`);

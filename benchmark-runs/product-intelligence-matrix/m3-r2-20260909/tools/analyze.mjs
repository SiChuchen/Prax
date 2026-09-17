#!/usr/bin/env node
/**
 * M3 Task 6/7 — (1) lock: hash all reviewer score files BEFORE any comparison;
 * (2) analyze: inter-reviewer agreement on blind ids, then unblind via the
 * private mapping and produce paired cell-level A/B outcomes, denominators,
 * costs, and sensitivity to exclusions. Writes review-agreement.md,
 * comparison.md, findings.yaml. Refuses to analyze without a lock file.
 *
 *   node analyze.mjs lock      # requires 40 score files (or --partial)
 *   node analyze.mjs analyze
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";

const OP = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r2-20260909";
const mode = process.argv[2];
const partial = process.argv.includes("--partial");
const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const opEv = (obj) => appendFileSync(`${OP}/operator-events.ndjson`, JSON.stringify({ ts: new Date().toISOString(), ...obj }) + "\n");
const DIMS = ["representation_fit", "primary_task_salience", "time_to_understand", "navigation_cost", "context_loss", "ui_surface_complexity", "accessibility", "frontend_rework", "acceptance_seed_coverage"];

if (mode === "lock") {
  const lines = [];
  for (const R of ["R1", "R2"]) {
    const dir = `${OP}/review/scores/${R}`;
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : [];
    for (const f of files) lines.push(`${sha256(`${dir}/${f}`)}  scores/${R}/${f}`);
  }
  if (lines.length < 40 && !partial) { console.error(`only ${lines.length}/40 score files; use --partial to lock anyway`); process.exit(2); }
  const body = `# M3 blind score lock — ${new Date().toISOString()} — ${lines.length} files\n${lines.join("\n")}\n`;
  writeFileSync(`${OP}/review/scores-lock.sha256`, body);
  opEv({ kind: "scores_locked", files: lines.length, lock_sha256: createHash("sha256").update(body).digest("hex") });
  console.log(`locked ${lines.length} score files`);
  process.exit(0);
}

if (mode !== "analyze") { console.error("usage: analyze.mjs lock|analyze"); process.exit(2); }
if (!existsSync(`${OP}/review/scores-lock.sha256`)) { console.error("no scores-lock.sha256 — lock before analyzing"); process.exit(2); }
// Verify lock integrity (no score file changed since lock).
const lock = readFileSync(`${OP}/review/scores-lock.sha256`, "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
let tampered = [];
for (const l of lock) { const [h, rel] = l.split(/\s+/); if (sha256(`${OP}/review/${rel}`) !== h) tampered.push(rel); }
if (tampered.length) { console.error("LOCK VIOLATION:", tampered); process.exit(3); }

// ---- load scores (blind) ---------------------------------------------------
const load = (R) => Object.fromEntries(readdirSync(`${OP}/review/scores/${R}`).filter((f) => f.endsWith(".json")).map((f) => {
  const rec = JSON.parse(readFileSync(`${OP}/review/scores/${R}/${f}`, "utf8"));
  return [rec.package_id, rec];
}));
const R1 = load("R1"), R2 = load("R2");
const ids = [...new Set([...Object.keys(R1), ...Object.keys(R2)])].sort();
const score = (rec, d) => rec?.parsed_ok ? (rec.scores?.scores?.[d]?.score ?? null) : null;

// ---- inter-reviewer agreement (still blind) --------------------------------
const agree = {};
for (const d of DIMS) {
  let n = 0, exact = 0, within1 = 0, sumAbs = 0;
  for (const id of ids) { const a = score(R1[id], d), b = score(R2[id], d); if (a === null || b === null) continue; n++; if (a === b) exact++; if (Math.abs(a - b) <= 1) within1++; sumAbs += Math.abs(a - b); }
  agree[d] = { n, exact_pct: n ? Math.round(100 * exact / n) : null, within1_pct: n ? Math.round(100 * within1 / n) : null, mean_abs_diff: n ? +(sumAbs / n).toFixed(2) : null };
}
const parsedCount = { R1: Object.values(R1).filter((r) => r.parsed_ok).length, R2: Object.values(R2).filter((r) => r.parsed_ok).length };

// ---- unblind -----------------------------------------------------------------
const mapping = JSON.parse(readFileSync(`${OP}/review/private/mapping.json`, "utf8"));
const leak = JSON.parse(readFileSync(`${OP}/review/private/leakage-scan.json`, "utf8"));
const ledgerText = readFileSync(`${OP}/run-ledger.yaml`, "utf8");
const ledgerRows = [...ledgerText.matchAll(/- run: "(run-\d+)"[\s\S]*?cell: "([^"]+)"[\s\S]*?arm: "(\w)"[\s\S]*?stop_reason: "([^"]+)"[\s\S]*?wall_clock_seconds: (\d+)[\s\S]*?token_in_out: ("not_observable"|\d+)[\s\S]*?cost_usd: ("not_observable"|[\d.]+)[\s\S]*?measurement_valid: (true|false)/g)]
  .map((m) => ({ run: m[1], cell: m[2], arm: m[3], stop: m[4], wall: +m[5], tokens: m[6] === '"not_observable"' ? null : +m[6], cost: m[7] === '"not_observable"' ? null : +m[7], mvalid: m[8] === "true" }));
const byRun = Object.fromEntries(ledgerRows.map((r) => [r.run, r]));

const rows = mapping.packages.map((p) => {
  const meanDim = (d) => { const v = [score(R1[p.id], d), score(R2[p.id], d)].filter((x) => x !== null); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; };
  const dims = Object.fromEntries(DIMS.map((d) => [d, meanDim(d)]));
  const scored = DIMS.map((d) => dims[d]).filter((x) => x !== null);
  const overall = scored.length ? +(scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(2) : null;
  const L = byRun[p.run] ?? {};
  return { id: p.id, run: p.run, cell: p.cell, arm: p.arm, dims, overall_mean_of_dims: overall, leakage_hits: leak[p.id]?.hits ?? 0, stop: L.stop, wall: L.wall, tokens: L.tokens, cost: L.cost, measurement_valid: L.mvalid };
});

// paired cell-level
const cells = [...new Set(rows.map((r) => r.cell))].sort();
const paired = cells.map((c) => {
  const a = rows.find((r) => r.cell === c && r.arm === "a"), b = rows.find((r) => r.cell === c && r.arm === "b");
  const diff = Object.fromEntries(DIMS.map((d) => [d, a?.dims[d] !== null && b?.dims[d] !== null && a && b ? +(b.dims[d] - a.dims[d]).toFixed(2) : null]));
  return { cell: c, a_id: a?.id, b_id: b?.id, a_overall: a?.overall_mean_of_dims, b_overall: b?.overall_mean_of_dims, b_minus_a_overall: a?.overall_mean_of_dims != null && b?.overall_mean_of_dims != null ? +(b.overall_mean_of_dims - a.overall_mean_of_dims).toFixed(2) : null, b_minus_a: diff, a_wall: a?.wall, b_wall: b?.wall, a_tokens: a?.tokens, b_tokens: b?.tokens, a_cost: a?.cost, b_cost: b?.cost, a_mvalid: a?.measurement_valid, b_mvalid: b?.measurement_valid, leakage: (a?.leakage_hits ?? 0) + (b?.leakage_hits ?? 0) };
});
const tally = (list) => { const v = list.filter((x) => x !== null && x !== undefined); return { n: v.length, b_better: v.filter((x) => x > 0).length, a_better: v.filter((x) => x < 0).length, tie: v.filter((x) => x === 0).length, mean_diff: v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null }; };
const overallTally = tally(paired.map((p) => p.b_minus_a_overall));
const sensNoLeak = tally(paired.filter((p) => p.leakage === 0).map((p) => p.b_minus_a_overall));
const sensValidOnly = tally(paired.filter((p) => p.a_mvalid && p.b_mvalid).map((p) => p.b_minus_a_overall));
const dimTally = Object.fromEntries(DIMS.map((d) => [d, tally(paired.map((p) => p.b_minus_a[d]))]));
const armAgg = (arm) => { const rs = rows.filter((r) => r.arm === arm); const num = (k) => rs.map((r) => r[k]).filter((x) => typeof x === "number"); const mean = (v) => v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null; return { runs: rs.length, agent_completed: rs.filter((r) => r.stop === "agent_completed").length, measurement_valid: rs.filter((r) => r.measurement_valid).length, mean_wall_s: mean(num("wall")), mean_tokens: mean(num("tokens")), tokens_observable: num("tokens").length, mean_cost_usd: mean(num("cost")), mean_overall: mean(num("overall_mean_of_dims")) }; };
const A = armAgg("a"), B = armAgg("b");

writeFileSync(`${OP}/findings.yaml`, `# M3 pilot findings — generated ${new Date().toISOString()} after score lock and unblinding
# One heterogeneous run per cell/arm: exploratory only; no significance claims.
evidence_level: L1_single_run_per_cell_arm_pilot
denominators:
  planned: 20
  attempted: 20
  reviewer_parsed: { R1: ${parsedCount.R1}, R2: ${parsedCount.R2} }
  cells_paired_scored: ${overallTally.n}
arm_aggregates:
  a: ${JSON.stringify(A)}
  b: ${JSON.stringify(B)}
paired_overall_b_minus_a: ${JSON.stringify(overallTally)}
paired_by_dimension_b_minus_a:
${DIMS.map((d) => `  ${d}: ${JSON.stringify(dimTally[d])}`).join("\n")}
sensitivity:
  exclude_leakage_packages: ${JSON.stringify(sensNoLeak)}
  only_cells_both_arms_measurement_valid: ${JSON.stringify(sensValidOnly)}
inter_reviewer_agreement_blind:
${DIMS.map((d) => `  ${d}: ${JSON.stringify(agree[d])}`).join("\n")}
paired_cells:
${paired.map((p) => `  - ${JSON.stringify(p)}`).join("\n")}
runs:
${rows.map((r) => `  - ${JSON.stringify(r)}`).join("\n")}
`);

writeFileSync(`${OP}/review-agreement.md`, `# Review agreement (computed BLIND, before unblinding) — ${new Date().toISOString()}

Two independent fresh reviewers (R1, R2; identical rubric, model glm-5.3-flash[1M]
via claude 2.1.251, zero MCP, cwd locked to the anonymous package) scored all
packages. Scores were hashed and locked (review/scores-lock.sha256) before this
comparison. Parsed JSON: R1 ${parsedCount.R1}/20, R2 ${parsedCount.R2}/20.

| dimension | n | exact % | within ±1 % | mean |diff| |
|---|---|---|---|---|
${DIMS.map((d) => `| ${d} | ${agree[d].n} | ${agree[d].exact_pct} | ${agree[d].within1_pct} | ${agree[d].mean_abs_diff} |`).join("\n")}

This is outcome-review agreement between two model reviewers on a 1–5 rubric,
not the separate M4 taxonomy coding study and not human agreement. Unavoidable
unblinding: ${Object.entries(leak).filter(([, v]) => v.hits > 0).map(([id, v]) => `${id} (${v.hits} hit${v.hits > 1 ? "s" : ""})`).join(", ") || "none"} —
Prax vocabulary in code comments; recorded, product not edited; reviewers were
instructed not to speculate about provenance; sensitivity analysis excludes them.
`);

const fmt = (x) => x === null || x === undefined ? "—" : x;
writeFileSync(`${OP}/comparison.md`, `# M3 pilot comparison — ${new Date().toISOString()}

Scope: 10 cells × 2 arms × 1 planned run (20 runs). Exploratory pilot; one
heterogeneous run per cell/arm supports observations, NOT replicated per-cell
or statistically significant superiority claims. Conclusion may legitimately be
"no advantage" or "insufficient data".

## Denominators

- Planned 20 / attempted 20 / agent-declared completion 19 / wall-clock stopped 1 (run-14, B).
- Receipts 20/20; measurement valid (target not invalidated) 18/20 — invalid: run-13 (B, cell-j02-s02: app navigated to \`#_\` during measurement), run-17 (A, cell-j10-s09: page runtime error \`reading 'steps'\`).
- Blind-review eligible 20/20; reviewer JSON parsed R1 ${parsedCount.R1}/20, R2 ${parsedCount.R2}/20.
- Token telemetry observable 19/20 (run-14 not_observable: killed before result event).
- M3 gate: NOT CLOSED — 8/10 cells have both arms with valid measurement evidence.

## Arm aggregates (means over runs; costs from modelUsage input+output, D5 v2)

| | Arm A (bare) | Arm B (Prax) |
|---|---|---|
| runs / agent completed | ${A.runs} / ${A.agent_completed} | ${B.runs} / ${B.agent_completed} |
| measurement valid | ${A.measurement_valid} | ${B.measurement_valid} |
| mean wall clock (s) | ${fmt(A.mean_wall_s)} | ${fmt(B.mean_wall_s)} |
| mean tokens in+out (observable n) | ${fmt(A.mean_tokens)} (${A.tokens_observable}) | ${fmt(B.mean_tokens)} (${B.tokens_observable}) |
| mean cost USD | ${fmt(A.mean_cost_usd)} | ${fmt(B.mean_cost_usd)} |
| mean blind rubric (mean of 9 dims, 2 reviewers) | ${fmt(A.mean_overall)} | ${fmt(B.mean_overall)} |

## Paired cell-level outcome (B − A, mean of 9 dims averaged over both reviewers)

| cell | A id | B id | A | B | B−A | A wall | B wall | A tok | B tok | valid A/B | leak |
|---|---|---|---|---|---|---|---|---|---|---|---|
${paired.map((p) => `| ${p.cell} | ${p.a_id} | ${p.b_id} | ${fmt(p.a_overall)} | ${fmt(p.b_overall)} | ${fmt(p.b_minus_a_overall)} | ${fmt(p.a_wall)} | ${fmt(p.b_wall)} | ${fmt(p.a_tokens)} | ${fmt(p.b_tokens)} | ${p.a_mvalid}/${p.b_mvalid} | ${p.leakage} |`).join("\n")}

Overall tally (cells): B better ${overallTally.b_better}, A better ${overallTally.a_better}, tie ${overallTally.tie}, mean B−A ${fmt(overallTally.mean_diff)} (n=${overallTally.n}).

### By dimension (B − A tally over cells)

| dimension | n | B better | A better | tie | mean diff |
|---|---|---|---|---|---|
${DIMS.map((d) => `| ${d} | ${dimTally[d].n} | ${dimTally[d].b_better} | ${dimTally[d].a_better} | ${dimTally[d].tie} | ${fmt(dimTally[d].mean_diff)} |`).join("\n")}

### Sensitivity

- Excluding packages with unavoidable unblinding (Prax vocabulary in comments): B better ${sensNoLeak.b_better}, A better ${sensNoLeak.a_better}, tie ${sensNoLeak.tie}, mean ${fmt(sensNoLeak.mean_diff)} (n=${sensNoLeak.n}).
- Only cells where BOTH arms have valid measurement: B better ${sensValidOnly.b_better}, A better ${sensValidOnly.a_better}, tie ${sensValidOnly.tie}, mean ${fmt(sensValidOnly.mean_diff)} (n=${sensValidOnly.n}).

## Objective layer (seven browser checks; not task time / retrieval / preference)

See run-ledger.yaml \`checks\` per run. These checks do not measure task
completion time, information retrieval accuracy, user error rate, or human
preference — all marked not_observable in this pilot. Model preference is not
human preference.

## What this pilot does and does not support

- Supports: exploratory paired observations across 10 heterogeneous cells,
  process-reliability observations (completion, wall clock, token cost, gate
  friction), and measurement-validity accounting.
- Does not support: replicated per-cell claims, significance, human-preference
  claims, or any promotion of checks/knowledge (deferred).
`);
console.log(JSON.stringify({ parsedCount, overallTally, sensNoLeak, sensValidOnly, A, B }, null, 2));
opEv({ kind: "analysis_written", overall_tally: overallTally, sensitivity_no_leak: sensNoLeak, sensitivity_valid_only: sensValidOnly });

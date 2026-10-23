#!/usr/bin/env node
/** Pooled n=3 view (R1+R2+R3) — same R5 rule: arm score = mean over valid runs. */
import { readFileSync, writeFileSync } from "node:fs";

const REPO = "E:/codex-prj/Prax/Prax";
const OPS = [
  ["R1", `${REPO}/benchmark-runs/product-intelligence-matrix/m3-20260906`],
  ["R2", `${REPO}/benchmark-runs/product-intelligence-matrix/m3-r2-20260909`],
  ["R3", `${REPO}/benchmark-runs/product-intelligence-matrix/m3-r3-ablation-20260918`],
];
const DIMS = ["representation_fit", "primary_task_salience", "time_to_understand", "navigation_cost", "context_loss", "ui_surface_complexity", "accessibility", "frontend_rework", "acceptance_seed_coverage"];
const parseRuns = (file) => { const t = readFileSync(file, "utf8"); const s = t.slice(t.lastIndexOf("\nruns:\n") + 7); return [...s.matchAll(/^  - (\{.*\})$/gm)].map((m) => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean); };
const all = [];
for (const [label, op] of OPS) for (const r of parseRuns(`${op}/findings.yaml`)) all.push({ ...r, round: label });
if (all.length !== 60) throw new Error(`expected 60 runs, got ${all.length}`);
const mean = (v) => v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null;
const cells = [...new Set(all.map((r) => r.cell))].sort();
const pooled = cells.map((cell) => {
  const out = {};
  for (const arm of ["a", "b"]) {
    const rs = all.filter((r) => r.cell === cell && r.arm === arm);
    const valid = rs.filter((r) => r.measurement_valid && r.overall_mean_of_dims !== null);
    out[arm] = { valid: valid.length, runs: rs.length, overall: mean(valid.map((r) => r.overall_mean_of_dims)), rounds_valid: valid.map((r) => r.round) };
  }
  return { cell, ...out, pairable: out.a.valid > 0 && out.b.valid > 0, b_minus_a: out.a.overall !== null && out.b.overall !== null ? +(out.b.overall - out.a.overall).toFixed(2) : null };
});
const pairable = pooled.filter((p) => p.pairable && p.b_minus_a !== null);
const tally = (v) => ({ n: v.length, b_better: v.filter((x) => x > 0).length, a_better: v.filter((x) => x < 0).length, tie: v.filter((x) => x === 0).length, mean_diff: mean(v) });
const T = tally(pairable.map((p) => p.b_minus_a));
const agg = (arm) => { const rs = all.filter((r) => r.arm === arm); const num = (k) => rs.map((r) => r[k]).filter((x) => typeof x === "number"); const valid = rs.filter((r) => r.measurement_valid && r.overall_mean_of_dims !== null); return { runs: rs.length, agent_completed: rs.filter((r) => r.stop === "agent_completed").length, measurement_valid: rs.filter((r) => r.measurement_valid).length, mean_wall_s: mean(num("wall")), mean_tokens: mean(num("tokens")), mean_cost_usd: mean(num("cost")), mean_rubric_over_valid: mean(valid.map((r) => r.overall_mean_of_dims)) }; };
const A = agg("a"), B = agg("b");
const OP3 = OPS[2][1];
writeFileSync(`${OP3}/pooled-n3-findings.yaml`, `# M3 pooled n=3 findings (R1+R2+R3) — generated ${new Date().toISOString()}
rule: "arm score = mean over valid runs across rounds; no best-of selection (addendum R5 lineage)"
pooled_overall_tally: ${JSON.stringify(T)}
arm_aggregates_all_runs: { a: ${JSON.stringify(A)}, b: ${JSON.stringify(B)} }
per_cell_pooled:
${pooled.map((p) => `  - ${JSON.stringify(p)}`).join("\n")}
`);
console.log(JSON.stringify({ T, A, B }, null, 2));

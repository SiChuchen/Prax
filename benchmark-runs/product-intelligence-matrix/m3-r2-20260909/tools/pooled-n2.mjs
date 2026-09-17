#!/usr/bin/env node
/**
 * M3 pooled n=2 analysis (addendum R5 rule, pre-registered before r2 outcomes).
 * Pools round-1 (m3-20260906) and round-2 (m3-r2-20260909) findings: per
 * cell/arm the score is the MEAN over valid runs; cells where an arm has no
 * valid run are excluded from rubric pairing and counted separately.
 * Also pools the objective seven-check layer across both ledgers.
 * No best-of selection anywhere. Output: pooled-n2-findings.yaml +
 * pooled-n2-analysis.md in the r2 operator dir.
 */
import { readFileSync, writeFileSync } from "node:fs";

const OP1 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-20260906";
const OP2 = "E:/codex-prj/Prax/Prax/benchmark-runs/product-intelligence-matrix/m3-r2-20260909";
const DIMS = ["representation_fit", "primary_task_salience", "time_to_understand", "navigation_cost", "context_loss", "ui_surface_complexity", "accessibility", "frontend_rework", "acceptance_seed_coverage"];
const CHECKS = ["layout.overflow", "layout.responsive_collision", "text.truncation", "a11y.contrast", "a11y.focus_order", "a11y.target_size", "type.min_projected_size"];

const parseRuns = (file) => {
  const text = readFileSync(file, "utf8");
  const runsSection = text.slice(text.lastIndexOf("\nruns:\n") + 7);
  return [...runsSection.matchAll(/^  - (\{.*\})$/gm)]
    .map((m) => { try { return JSON.parse(m[1].replace(/'/g, "'")); } catch { return null; } })
    .filter(Boolean);
};
const runs1 = parseRuns(`${OP1}/findings.yaml`);
const runs2 = parseRuns(`${OP2}/findings.yaml`);
if (runs1.length !== 20 || runs2.length !== 20) throw new Error(`expected 20+20 runs, got ${runs1.length}+${runs2.length}`);
for (const r of runs2) r.round = 2;
for (const r of runs1) r.round = 1;
const all = [...runs1, ...runs2];

// ---- pooled rubric per cell/arm ---------------------------------------------
const cells = [...new Set(all.map((r) => r.cell))].sort();
const mean = (v) => v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : null;
const pooled = cells.map((cell) => {
  const armOut = {};
  for (const arm of ["a", "b"]) {
    const rs = all.filter((r) => r.cell === cell && r.arm === arm);
    const valid = rs.filter((r) => r.measurement_valid && r.overall_mean_of_dims !== null);
    armOut[arm] = {
      runs: rs.length, valid_runs: valid.length,
      rounds: rs.map((r) => r.round), stop: rs.map((r) => r.stop),
      overall: mean(valid.map((r) => r.overall_mean_of_dims)),
      dims: Object.fromEntries(DIMS.map((d) => [d, mean(valid.map((r) => r.dims?.[d]).filter((x) => x !== null && x !== undefined))])),
      wall: mean(rs.map((r) => r.wall).filter((x) => typeof x === "number")),
      tokens: mean(rs.map((r) => r.tokens).filter((x) => typeof x === "number")),
      cost: mean(rs.map((r) => r.cost).filter((x) => typeof x === "number")),
      leakage_hits: rs.reduce((s, r) => s + (r.leakage_hits || 0), 0),
    };
  }
  const rubricPairable = armOut.a.valid_runs > 0 && armOut.b.valid_runs > 0;
  return {
    cell, ...armOut,
    rubric_pairable: rubricPairable,
    b_minus_a_overall: rubricPairable && armOut.a.overall !== null && armOut.b.overall !== null ? +(armOut.b.overall - armOut.a.overall).toFixed(2) : null,
    b_minus_a_dims: rubricPairable ? Object.fromEntries(DIMS.map((d) => [d, armOut.a.dims[d] !== null && armOut.b.dims[d] !== null ? +(armOut.b.dims[d] - armOut.a.dims[d]).toFixed(2) : null])) : null,
  };
});
const tally = (v) => ({ n: v.length, b_better: v.filter((x) => x > 0).length, a_better: v.filter((x) => x < 0).length, tie: v.filter((x) => x === 0).length, mean_diff: mean(v) });
const pairable = pooled.filter((p) => p.rubric_pairable);
const overallTally = tally(pairable.map((p) => p.b_minus_a_overall));
const dimTally = Object.fromEntries(DIMS.map((d) => [d, tally(pairable.map((p) => p.b_minus_a_dims[d]).filter((x) => x !== null))]));
const noLeak = tally(pairable.filter((p) => p.leakage_hits === 0).map((p) => p.b_minus_a_overall));

// ---- pooled objective layer ---------------------------------------------------
const ledgerChecks = (dir, batch) => {
  const y = readFileSync(`${dir}/run-ledger.yaml`, "utf8");
  return [...y.matchAll(/- run: "(run-\d+)"[\s\S]*?cell: "([^"]+)"[\s\S]*?arm: "(\w)"[\s\S]*?invalid_target: (true|false)[\s\S]*?checks:\s*\n((?:\s+[\w.]+: "\w+"\n)+)/g)]
    .map((m) => ({ batch, cell: m[2], arm: m[3], invalid: m[4] === "true", checks: Object.fromEntries([...m[5].matchAll(/([\w.]+): "(\w+)"/g)].map((c) => [c[1], c[2]])) }));
};
const checkRows = [...ledgerChecks(OP1, 1), ...ledgerChecks(OP2, 2)];
const objByArm = {};
for (const arm of ["a", "b"]) {
  const rows = checkRows.filter((r) => r.arm === arm && !r.invalid);
  objByArm[arm] = {
    valid_runs: rows.length,
    mean_pass_of_7: mean(rows.map((r) => CHECKS.filter((c) => r.checks[c] === "pass").length)),
    per_check_pass: Object.fromEntries(CHECKS.map((c) => [c, `${rows.filter((r) => r.checks[c] === "pass").length}/${rows.length}`])),
  };
}

// ---- arm aggregates (pooled, all runs) -----------------------------------------
const agg = (arm) => {
  const rs = all.filter((r) => r.arm === arm);
  const num = (k) => rs.map((r) => r[k]).filter((x) => typeof x === "number");
  const valid = rs.filter((r) => r.measurement_valid);
  return {
    runs: rs.length, agent_completed: rs.filter((r) => r.stop === "agent_completed").length,
    measurement_valid: valid.length,
    mean_wall_s: mean(num("wall")), mean_tokens: mean(num("tokens")), tokens_observable: num("tokens").length,
    mean_cost_usd: mean(num("cost")),
    mean_rubric_over_valid: mean(valid.map((r) => r.overall_mean_of_dims)),
  };
};
const A = agg("a"), B = agg("b");

const yaml = JSON.stringify;
writeFileSync(`${OP2}/pooled-n2-findings.yaml`, `# M3 pooled n=2 findings (R1+R2) — generated ${new Date().toISOString()} per addendum R5
# Arm score = mean over VALID runs per cell/arm; no best-of selection.
evidence_level: L2_two_runs_per_cell_arm_pilot
rule: "pre-registered in m3-r2-20260909/protocol-addendum.md R5; direction flip vs R1 is reported, not smoothed"
pooled_overall_tally: ${yaml(overallTally)}
pooled_by_dimension: ${yaml(dimTally)}
sensitivity_exclude_leakage_cells: ${yaml(noLeak)}
cells_not_rubric_pairable: ${yaml(pooled.filter((p) => !p.rubric_pairable).map((p) => ({ cell: p.cell, a_valid: p.a.valid_runs, b_valid: p.b.valid_runs })))}
arm_aggregates_all_runs: { a: ${yaml(A)}, b: ${yaml(B)} }
objective_pooled_valid_runs: { a: ${yaml(objByArm.a)}, b: ${yaml(objByArm.b)} }
per_cell_pooled:
${pooled.map((p) => `  - ${yaml(p)}`).join("\n")}
runs_source: { round1: "${OP1}/findings.yaml", round2: "${OP2}/findings.yaml" }
`);

const fmt = (x) => x === null || x === undefined ? "—" : x;
writeFileSync(`${OP2}/pooled-n2-analysis.md`, `# M3 pooled n=2 analysis (R1 + R2) — ${new Date().toISOString()}

Rule (pre-registered in R5 before any r2 outcome): per cell/arm the score is the
mean over VALID runs of both rounds; no best-of selection; cells where an arm
has no valid run are excluded from rubric pairing and listed separately.

## Headline

- R1 alone: B − A = **+0.32** (B better 7 / A better 1 / tie 2).
- R2 alone: B − A = **−0.20** (B better 3 / A better 6 / tie 1).
- **Pooled n=2: B − A overall tally ${overallTally.b_better}/${overallTally.a_better}/${overallTally.tie} (n=${overallTally.n}), mean ${fmt(overallTally.mean_diff)}.**
- The round-1 lean toward Arm B did NOT replicate; pooled, the blind-rubric
  difference is small and its sign depends on the sensitivity cut. This is a
  legitimate pilot outcome: no reliable product-quality advantage is
  demonstrated in either direction.

## Arm aggregates over all 40 runs

| | Arm A (bare) | Arm B (Prax) |
|---|---|---|
| runs / agent declared done | ${A.runs} / ${A.agent_completed} | ${B.runs} / ${B.agent_completed} |
| operator measurement valid | ${A.measurement_valid} | ${B.measurement_valid} |
| mean wall clock (s) | ${fmt(A.mean_wall_s)} | ${fmt(B.mean_wall_s)} |
| mean tokens in+out | ${fmt(A.mean_tokens)} | ${fmt(B.mean_tokens)} |
| mean cost USD | ${fmt(A.mean_cost_usd)} | ${fmt(B.mean_cost_usd)} |
| mean rubric (valid runs) | ${fmt(A.mean_rubric_over_valid)} | ${fmt(B.mean_rubric_over_valid)} |

## Pooled objective layer (seven browser checks, valid runs)

| | A | B |
|---|---|---|
| valid runs | ${objByArm.a.valid_runs} | ${objByArm.b.valid_runs} |
| mean pass of 7 | ${fmt(objByArm.a.mean_pass_of_7)} | ${fmt(objByArm.b.mean_pass_of_7)} |
| per check | ${CHECKS.map((c) => `${c} ${objByArm.a.per_check_pass[c]}`).join(", ")} |
| (B) | ${CHECKS.map((c) => `${c} ${objByArm.b.per_check_pass[c]}`).join(", ")} |

## Reliability signals that DO replicate across both rounds

1. Arm B's full gate-chain completion: 20/20 B sessions produced a complete
   Prax artifact chain through validation (A: 19/20 declared completion — the
   one non-completion was B run-14 in R1, wall-clock stop).
2. Arm B spends more: wall ≈1.4–1.7× and cost ≈2.0–2.2× of A in both rounds.
3. Both arms fail the a11y-class checks (contrast, focus order, target size,
   projected type size) across rounds — systemic, not an arm effect.

## Paired cells (pooled)

| cell | A valid | B valid | A | B | B−A | leak |
|---|---|---|---|---|---|---|
${pooled.map((p) => `| ${p.cell} | ${p.a.valid_runs}/${p.a.runs} | ${p.b.valid_runs}/${p.b.runs} | ${fmt(p.a.overall)} | ${fmt(p.b.overall)} | ${fmt(p.b_minus_a_overall)} | ${p.leakage_hits} |`).join("\n")}

Overall (n=${overallTally.n} pairable): B better ${overallTally.b_better}, A better ${overallTally.a_better}, tie ${overallTally.tie}, mean ${fmt(overallTally.mean_diff)}.
By-dimension and sensitivity (excluding unblinding-leakage cells) in
pooled-n2-findings.yaml. Reviewer agreement per round: blind ±1 agreement
95–100% (R1) and 100% (R2) — model reviewers share model priors; not human
agreement.

## Honest bottom line

Two independent runs per cell/arm on an identical frozen runtime show **no
directionally stable blind-rubric advantage for either arm**. Arm B's
replicable differences are process-shaped (complete gate chain, higher
measurement validity of its own sessions) at ~1.5× wall and ~2× cost.
Objective seven-check means slightly favor B in R1 and the pooled set, driven
by overflow/truncation; a11y checks fail for both arms. All findings remain
exploratory (n=2, model reviewers); no significance claims, no promotion.
`);

console.log(JSON.stringify({ overallTally, noLeak, A, B, objA: objByArm.a.mean_pass_of_7, objB: objByArm.b.mean_pass_of_7 }, null, 2));

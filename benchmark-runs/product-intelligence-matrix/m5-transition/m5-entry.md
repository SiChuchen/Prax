# M5 entry — analysis report, blind-agreement record, and three-way 回流 verdict

Generated 2026-09-17 as the M5 program entry deliverable (program plan
2026-09-02: 门禁 M5 = 分析报告 + 盲评一致率 + 三路回流落地或明确 defer).
Inputs: R1+R2 findings/ledgers (40 runs), pooled-n2-analysis, attribution.md.
No check rule, knowledge entry, or product code was changed by this batch.

## 1. 分析报告

- `m3-r2-20260909/pooled-n2-analysis.md` (+findings.yaml): pooled n=2 across
  40 runs. Blind rubric pooled tie (B−A 5/5/0, mean 0.00); R1's +0.32 did not
  replicate (R2 −0.20). Objective layer pooled: B 3.0/7 vs A 2.69/7 (overflow/
  truncation driven). Costs: B ≈1.5× wall, ≈1.6× USD.
- `attribution.md`: corrected gate-chain stats, validate closing gap,
  knowledge-routing evidence, outcome reconciliation.
- M3 gate: stays NOT_CLOSED (R1 8/10, R2 7/10 cells both-arms valid); with n=2
  pooled the gate question is superseded by the pooled analysis — 9/10 cells
  have ≥1 valid run per arm (all but none: per-cell valid counts in
  pooled-n2-findings.yaml).

## 2. 盲评一致率

R1: exact 58–100%, within ±1 95–100% (weakest: frontend_rework 58%,
ui_surface_complexity 65%). R2: exact 40–100%, within ±1 100% (weakest:
frontend_rework 40%). Interpretation: two model reviewers with the same model
share priors — agreement here certifies rubric comprehension, not human-level
reliability. frontend_rework is the one dimension to re-specify (needs a
defect-count anchor from receipts rather than visual judgment) before any
future round reuses it.

## 3. 三路回流

### ① 检查目录提案（提案，未晋升）
- **No promotion**: zero-overkill evidence for changing error-tier checks does
  not exist in this batch. The a11y-class near-universal failures are a
  calibration/investigation signal, not a threshold change case.
- **Investigate before building**: why do both arms fail contrast (1/16 vs
  2/19), focus order, target size, projected type size at >85%? Candidate
  root causes: missing threshold knowledge (fixable by a knowledge entry with
  exact WCAG numbers), CSS defaults in agent-chosen stacks, or check
  sensitivity. Owner: next engineering slice, with golden-app calibration.
- **Revise (measurement, not checks)**: `run-cell.mjs` remains unfit for
  multi-run use (bypassed); a `--static` serve override in prax-measure would
  have made D8 v2 staging unnecessary — candidate for the next runtime slice
  with its own spec.

### ② 知识收录
- `new_general_rules: []` (AB-001 convention held: nothing observed generalizes
  beyond project-local facts at this evidence level).
- Candidate knowledge entry (defers to the 18-问规程 with the next run batch):
  "agent stacks ship low-contrast palettes by default; state exact contrast
  ratios and focus-indicator requirements in the brief or an a11y knowledge
  entry" — trigger_conditions would be `stack: any`, authority: initial.
- Lessons recorded (benchmark ops): launch-config checklist per round (the
  missing mcp-config-empty.json), MSYS_NO_PATHCONV for `--entry /`, frozen
  CLI's dist→vite heuristic, AB-001 token metric convention, validate closing
  gap.

### ③ keep / revise / remove / defer
| item | verdict | evidence |
|---|---|---|
| validation-before-code (B flow) | **keep** | 20/20 declare measurement_target; 13/20 self-measure; B own-session receipt validity 19/20 vs A 16/20 |
| validate gate loop UX | **revise (product)** | 14/20 sessions never reach COMPLETE; several with all items passing — closing-gap friction (attribution.md §3) |
| knowledge routing set | **keep** | 17 entries actively disclosed; vocabulary survives into delivered code |
| correction memory | **keep, low usage** | 6/20 runs wrote corrections; no misfires observed |
| run-cell.mjs wrapper | **remove from benchmark use** | latest-receipt lookup unsafe (D3); direct CLI is the documented path |
| rubric dimension frontend_rework | **revise** | inter-reviewer exact 58%/40% — anchor to receipt defect counts |
| 150-cell expansion | **defer** | pooled tie + sign flips: expansion would measure noise at n=1–2; replan trigger NOT pulled |
| M4 inter-rater coding study | **defer** (unchanged) | taxonomy coding needs stable material; pilot tie gives no saturation signal |
| round 3 (n=3 on flipped cells) | **defer** | 4 flipped cells + pooled 0.00: expected information ≈ ±0.1–0.2 for ~15 run-hours; only justified if a concrete decision hinges on sign |
| human preference / task-time measurement | **defer** | not observable in this design; remains the missing measurement for any preference claim |

## 4. Honest bottom line for the program

At n=2 with model reviewers: **no product-quality advantage for Prax is
demonstrated; a process-reliability and knowledge-routing footprint is real
but did not convert into measurable quality at this budget.** The a11y
failure cluster and the validate closing gap are the two highest-value
engineering follow-ups surfaced by the pilot. 150-cell expansion is not
justified by current evidence.

## 5. Output index

- attribution.md (this directory) · pooled-n2-analysis.md / pooled-n2-findings.yaml (m3-r2-20260909) ·
  run-ledger.yaml ×2 · comparison/findings/review-agreement ×2 rounds ·
  b-session-audit.yaml · operator-events.ndjson ×2.

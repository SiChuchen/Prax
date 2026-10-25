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

## 6. R3 ablation + pooled n=3 update (2026-10-24)

R3 (`m3-r3-ablation-20260918`) closed 2026-10-24; full record in
`../m3-r3-ablation-20260918/ablation-report.md` (+ §6 verification addendum,
`pooled-n3-findings.yaml`, `pre-analysis-note.md` v2). Key entries for this
ledger:

- **Pooled n=3 (90 runs)**: blind rubric A 4.38 vs B 4.39 (cells 6/4 split) —
  the §4 tie conclusion HOLDS at n=3. B cost ≈1.7× A. The 150-cell expansion
  **defer** stands.
- **H-23 causal ablation verdict: NEGATIVE at the pre-registered bar**, with a
  two-stage mechanism (independently verified): router selection 9/10 →
  design_inspect surfacing only 2/10 → of the surfaced, 0/2 clean improvement.
  The pilot's "knowledge-routing footprint" (§4) now has its Gate B answer:
  **routing works, surfacing breaks, application unproven**.
- Three-way 回流 updates:
  | item | action | basis |
  |---|---|---|
  | §3 investigate-before-building (a11y root cause) | **done** | a11y-root-cause.md → H-23 admission → r3 ablation |
  | H-23 entry lifecycle | **keep draft; rewrite-and-reprobe on a second cell is the only permitted next step** | probe protocol §3 action caps; retirement needs multi-cell evidence |
  | disclosure layer engineering (auto-expand admitted entries at decide/validation) | **candidate, pending m4 probe** | m4-probe-20261024 running (P0/P1x2/P2x2/P3/P3p, contrastive locator) |
  | measure→fix loop in design_validate | **candidate, pending m4 probe P3 vs P3p** | same batch, placebo-controlled |
  | frontend_rework rubric revision | unchanged defer-to-next-round | r3 inter-reviewer exact 35% — worse at n=3, re-specify before reuse |
- **m4 contrastive probe batch in flight** (`m4-probe-20261024/protocol.md`,
  frozen before runs; readout matrix pre-registered). Its report supersedes
  the "candidate" rows above when it lands.

## 7. m4 contrastive probe update (2026-10-24)

Batch `m4-probe-20261024` complete (7/7 slots, $97.37 — ceiling deviation
recorded). Full record: `../m4-probe-20261024/probe-report.md` +
operator-events (4 freeze-tracked tool fixes; all readout-semantics-preserving).

- **Mechanical verdict: matrix row 7 (residual pattern)** — none of the
  pre-registered rows matched. The measured shape:
  P0 0/0 · P1 c=1 t=1 · P2 c=1 t=1 · P3 c=1 t=1 (2-round, F1) · P3p 0/0
  (2-round, placebo).
- **H-23 full-text injection (P2) shows no increment over standard Prax (P1)**:
  with content delivery guaranteed, behavior distribution is unchanged —
  supports "entry as authored is near-inert" (row-4 direction), but…
- **…the feedback loop shows a real signal (P3 > P3p)**: the F1 round
  (check-results-only feedback) took s6 from 5 mid-flight fails to 2 final
  fails (contrast/type/target all fixed), while the placebo second round
  (P3p) changed nothing (6→6). Effort alone does not do this; measurement
  content does.
- **Variance dominates this cell**: same config produces all-pass (s3/s4) and
  all-fail (s2/s5) runs; P1's in-batch 1/2 vs r3's 0/9 on this cell is a
  replication gap. n=1–2 arms cannot resolve these effects further.

Three-way 回流 updates:

| item | action | basis |
|---|---|---|
| disclosure-layer auto-expansion | **deprioritized** | P2≈P1: guaranteed delivery of H-23 content produced no increment |
| measure→fix loop in design_validate | **promoted to engineering candidate #1** | P3>P3p with s6 mechanism evidence (5-fail→2-fail in one round) |
| H-23 lifecycle | **keep draft; rewrite is now evidence-backed** (palette-level dos/don'ts, per a11y-root-cause) but re-probe must use multi-cell or higher-n design given cell variance | this batch |
| probe mode | **not adopted as standard** (protocol cap); its readout tooling (parseChecks/skipped-vs-pass/partial-pass) needed 3 fixes — harden before reuse | this batch |

Engineering implication: the highest-value change surfaced by M3–M4 is
**closing the measure→fix loop inside Prax** (feed prax-measure results back
at design_validate time), not knowledge-entry expansion.

## 8. m5 loop-validation update (2026-10-24)

Batch `m5-loop-20261024` complete (6/6 slots, freeze commit 4e9b370 before
any run; $45.68 observed + $15 D-1 allowance ≈ $60.7 / $120 ceiling). Full
record: `../m5-loop-20261024/m5-report.md` (+ operator addendum) ·
protocol.md (pre-registered matrix) · operator-events (D-0 snapshot-test
fixtures, D-1 unobservable-cost allowance).

Design: E1 = m5 frozen runtime `fbf222e1` (ADR-006, commit 2ccb60e; sole
packages/ delta vs r3 snapshot, manifest-verified; prax-measure/prax-knowledge
byte-identical) vs E0 = r3 frozen runtime `681653b4`; cells j13-s10 + j10-s09,
interleaved; 90-min/1.2M single-round budget; MCP_TIMEOUT=180000 both arms.

- **G1 (Gate F closing) verdict: row 3 NEGATIVE at n=4** — C(E1)=1/4 vs
  C(E0)=0/2 (historical 30%). The loop did not reliably flip phase to
  COMPLETE. Both pre-registered row-3 branch labels misdescribe the data
  (unavailable=0/4 — not infra; fix_required≥2 in 4/4 — not ignored):
  recorded as a branch-text residual.
- **G2 (a11y objective): large positive** — contrast 4/4 vs 0/2, target_size
  4/4 vs 0/2, focus 4/4 vs 1/2 (no regression); blind spot =
  type.min_projected_size (1/4 vs 1/2; smallest-px feedback does not convert).
  s6: all 7 checks green yet still VALIDATION.
- **Mechanism (transcripts)**: the loop converts non-measurement into
  measurement (validate calls 15/11/8/9 vs 0/6; 4–5 self-run receipts per E1
  session), then the bottleneck moves downstream: `MEASUREMENT_RECEIPT_MISSING`
  / `MEASUREMENT_BINDING_INVALID` cycles ending in
  `VALIDATION_CONVERGENCE_STALLED` (REVIEW) in all three non-completing E1
  runs. The closing wall is now the B3 convergence history × receipt-binding
  interaction, not agent unwillingness to measure.

Three-way 回流 updates:

| item | action | basis |
|---|---|---|
| ADR-006 lifecycle | **keep; iterate implementation** (row-3 action cap) — candidate fix #1: exclude measurement-loop-adjacent re-submits from the B3 convergence history (ADR-006 §4 intent vs observed stalls); candidate #2: lighten stall→REVIEW recovery ("lighter completion ack", §3) | this batch |
| measure→fix loop value | **re-scoped**: proven for measured a11y conversion (G2), NOT yet for session closing (G1) | this batch |
| H-23 lifecycle | **unchanged**: rewrite-and-reprobe still deferred (pre-registered in m5 protocol §1; needs multi-cell batch) | m5 protocol |
| type.min_projected_size | **new blind-spot entry**: feedback carries measured px but 3/4 E1 runs still shipped sub-12px text — investigate feedback phrasing vs check semantics before next batch | this batch |

### §8.1 m5.1 engineering slice (2026-10-25)

ADR-006 amendment delivered (candidate fix #1 from §8): zero-open-finding
non-PASS rounds no longer append to the B3 convergence history (s4 phenotype
[0,0,0,0] fixed; stall persists through them; ≥1-finding stalls unchanged).
400/400 tests (2 new). The s5/s6 phenotype (flat-3 SDIR-contract findings —
`representation_decided`, `state_ownership_declared`,
`acceptance_contract_present` failing while measured product is green) is the
detector working as designed; registered as a separate discoverability gap
(agents did not act on these check ids): candidate next slice = stall/EXPAND
output gains a per-finding fix-path hint (which tool regenerates the missing
artifact fields). Verification of the m5.1 change in a live B-arm batch is
NOT yet run — pre-register before doing so.

### §8.2 m5p1 live verification of the m5.1 amendment (2026-10-25)

Batch `m5p1-verify-20261025` complete (freeze 3d2e8f7 before any run; 6/6,
$46.54/$120, no wall kills). E1' = m5p1 runtime `183410df` (ADR-006+m5.1)
vs E0' = m5 runtime `fbf222e1` (ADR-006 only; sole delta = the 7 m5.1
files). Full record: `../m5p1-verify-20261025/m5p1-report.md` + addendum.

- **Mechanical verdict: row 2 (PARTIAL)** — C(E1')=2/4 vs C(E0')=0/2;
  **Z1=0** (the m5.1 code path held in every live session).
- **Mechanism**: both controls replicated the m5 s4 zero_stall phenotype
  ([0,0,0,0], VALIDATION); zero E1' sessions stalled by any path; the two
  closing E1' runs pushed through 3–4 receipt-missing EXPAND rounds (the
  exact rounds that stalled m5's s4) and closed. m5.1's wall is confirmed
  removed in the wild.
- **New residual, sharper than the old one**: both non-closing E1' runs
  ENDED ON A PASS — PASS-with-missing-evidence did not surface what was
  outstanding, and the agent stopped. Gate F's next bottleneck = the
  completion handoff (m5-entry §3 candidate #2: "n items outstanding"),
  promoted to candidate #1 for the next slice.
- G2 replication: contrast 3/4 (s6 post-final-edit regression), focus 4/4,
  target 4/4 — the a11y conversion from m5 holds with m5.1 in the runtime.

### §8.3 m5.2 fix-path discoverability slice shipped (2026-10-25, commit 39e5995)

Implemented while m5p1 ran (evidence-locked to m5 s5/s6 transcripts):
design_sdir 0.1-fallback warning naming the incomplete upstream artifact;
`fix_hint` on failing checks (0.2 chain / apply_delta fields / receipt
path); deduped `fix_paths` on VALIDATION_CONVERGENCE_STALLED. 403/403
green. NOTE: the findings-stall phenotype did not recur in m5p1's E1'
(0/4) — m5.2's live effect is unverified; piggyback its verification on the
next batch alongside the §8.2 handoff candidate.

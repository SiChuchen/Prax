# M3 pilot follow-ups — Task 7 (2026-09-09, after score lock + unblinding)

Companion files: `comparison.md` (paired outcomes, denominators, sensitivity),
`findings.yaml` (machine-readable), `review-agreement.md` (blind agreement),
`run-ledger.yaml` (Task 5 audit), `protocol-addendum.md` (D1–D10 + changelog).

## 1. Process reliability (unblinded, mechanical evidence)

| | Arm A (bare) | Arm B (Prax) |
|---|---|---|
| runs / agent declared done | 10 / 10 | 10 / 9 (run-14 stopped at 90 min) |
| operator measurement valid | 9/10 (run-17 page runtime error `reading 'steps'`) | 9/10 (run-13 app navigated to `#_` during measurement) |
| objective checks mean pass (valid runs, /7) | 2.78 | 3.56 |
| checks where B ≥ A | — | 6/7 (A ahead only on responsive_collision 9/9 vs 8/9) |
| per-cell objective pass (8 both-valid cells) | A better 1 (j06) | B better 5 (j01,j04,j05,j09,j13); tie 2 (j07,j08) |
| mean wall clock | 31.8 min | 53.4 min (≈1.7×) |
| mean tokens in+out (D5 v2) | 347K (n=10) | 483K (n=9; run-14 not_observable) |
| mean cost USD | 4.22 | 9.15 (≈2.2×) |
| full Prax gate chain reached validate | n/a | 10/10 sessions produced validation-report.yaml; run-16 workspace holds two sessions (agent restarted) |
| blind rubric mean (9 dims × 2 reviewers) | 4.18 | 4.50 |

Both arms fail most accessibility-class checks (contrast, focus order, target
size, projected type size) — a systemic pattern, not an arm effect.

## 2. Attribution of every non-clean slot (visible evidence only; no private reasoning inferred)

| slot | observation | classification |
|---|---|---|
| run-14 (B, j01-s01) | wall-clock stop at 5401 s; artifact present, measures 7/7 pass; agent never declared done | Prax gate friction OR agent pacing — INCONCLUSIVE (transcript shows full gate chain + measurement work; no contradicting decision) |
| run-13 (B, j02-s02) | measurement invalid: unexpected navigation to `#_` after readiness | product defect (hash navigation on load) |
| run-17 (A, j10-s09) | measurement invalid: page runtime error `Cannot read properties of undefined (reading 'steps')` | product defect (runtime error on initial page) |
| run-01 (B) | token telemetry initially written under a wrong metric; corrected by audit before run-02 | operator/measurement error (fixed, documented, no outcome impact) |
| run-13, run-15 (B) | agent vendored 45 MB / 2257-file tool trees into the workspace | agent behavior (screenshot tooling); excluded from blind source view, retained in snapshot |
| impl-08 / impl-10 / impl-13 | Prax vocabulary in code comments ("SDIR", "Prax 设计会话 ds_…") | unavoidable unblinding; recorded; sensitivity analysis excludes them |

## 3. Gate A–H (review checklist, spec §43; provisional, single-run evidence)

- **Gate A — did Prax materially change behavior?** Partially supported: all 10 B sessions walked the full chain to validation and 6/10 ran their own measurement inside the session; B's objective pass rate and blind rubric are higher on most cells, at ~1.7× time and ~2.2× cost. Not separable from "more time spent".
- **Gate B — which primitive caused value?** Not attributable from this pilot (no ablation). Candidate signals: validation-before-code (B measured itself in 6/10) and SDIR hierarchy vocabulary appearing in B code comments.
- **Gate C — missing context?** Both arms miss a11y checks systematically → knowledge gap / check-guidance gap candidate (not promoted here).
- **Gate D — second independent case before schema change?** Yes (default). This pilot is one run per cell.
- **Gate E — knowledge scope?** No promotion performed; no project correction elevated.
- **Gate F — supervision need?** run-14 suggests a time-box/checkpoint might help B declare done; single case — inconclusive.
- **Gate G — capability registry?** n/a (not built).
- **Gate H — repeated implementation asset?** Not assessed (needs M4 coding).
- Evidence level: L1 single-run pilot; no "significant" wording anywhere.
- Costs reported both arms (wall, tokens with one explicit not_observable, USD).

## 4. Keep / revise / remove / defer (supporting run ids)

- **Keep**: frozen-runtime snapshot + content rehash (all 20 runs on identical bytes); `--strict-mcp-config` arm isolation (A: 0 MCP in all 10 inits); per-run exclusive measurement `--out` (no stale receipt selection observed); pre-registered dual-viewport operator screenshots (20/20 captured, incl. run-14/13/17 where receipts alone would have been unusable).
- **Revise**: D5 token metric wording (fixed v2 before run-02; keep the AB-001 in+out convention going forward); D8 root staging (v2 needed after run-01 because the frozen CLI treats any `dist/` as Vite — consider a `--static` flag in a future runtime, NOT in this batch); run-one telemetry for killed sessions (fixed at run-14: not_observable, never zero).
- **Remove**: nothing from the frozen check catalogue; `run-cell.mjs` latest-receipt lookup remains unfit for multi-run use (bypassed, not edited).
- **Defer**: 150-cell expansion (insufficient evidence: 8/10 cells both-valid, n=1 each); M4 taxonomy coding/saturation; any check or knowledge promotion; human-preference and task-time measurement (not observable in this design); lifecycle binding / storage transactions.

## 5. Limitations (must accompany any citation of these results)

1. One heterogeneous run per cell/arm; 8/10 cells fully valid; no significance.
2. Reviewers are two fresh model sessions (same model as the arms), not humans; high agreement (±1: 95–100%) partly reflects shared model priors.
3. Three packages carried Prax fingerprints in comments; excluding them the B lean persists (6-0-1, +0.41) but n drops to 7.
4. Arm B spent ~1.7× wall clock and ~2.2× cost; quality deltas are not normalized for effort.
5. Seven browser checks ≠ task efficiency, retrieval accuracy, error rate, or human preference (all not_observable).
6. B session runtime verdicts (PASS/REVIEW at validate) were not mechanically extracted; D6's unprepared-0.2 REVIEW concern remains unverified per session.
7. Two launch failures (script bugs) and one detached-launch mishap occurred before agent turns; all preserved, none affected outcomes.

## 6. Next concrete action

Decide whether to run a second independent pass on the 8 both-valid cells (or
all 10) under the same frozen runtime to obtain n=2 before any product
conclusion; extract B session validate verdicts mechanically; then revisit the
150-cell decision at M5. No product, check, or knowledge changes in the
meantime.

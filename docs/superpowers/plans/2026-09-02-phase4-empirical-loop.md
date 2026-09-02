# Phase 4 Replan — Execution Plan (2026-09-02)

Spec: `docs/superpowers/specs/2026-09-02-phase4-empirical-loop.md`.
Conventions and cross-phase rules follow the program plan (TDD where code,
per-task commits, no push without instruction). Serial order — the tasks
share no code except F5 touching the measure tests.

## Tasks

- [x] **R1 replan docs** — this pair; commit `docs: phase 4 replan (empirical loop framework)`.
- [ ] **F1 matrix + harness** — `benchmarks/product-intelligence-matrix/matrix.yaml`
  (15 cells, §43 verbatim pairs) + `run-cell.mjs` (prax-measure wrapper,
  receipts under `benchmark-runs/product-intelligence-matrix/<cell>/`).
  Smoke: `node run-cell.mjs smoke --app apps/prax-dashboard` must produce a
  schema-valid receipt. Commit `feat(bench): product-intelligence matrix + measurement harness`.
- [ ] **F2 A/B protocol** — `ab-protocol.md` (arms, 13 metrics §44 verbatim,
  PRAX-AB-001 blind procedure, rubric-bias lesson). Commit `docs(bench): A/B protocol v1`.
- [ ] **F3 inter-rater + saturation** — `inter-rater-pilot.md` (§45 fields,
  dual-coding procedure) + `data/saturation-ledger.yaml` (§46 five counters,
  bands seeded). Commit `docs(bench): inter-rater pilot + pattern saturation ledger`.
- [ ] **F5 check promotion** — flip `ARTIFACT_CHECK_DEFAULT_SEVERITY` for
  `layout.overflow`, `layout.responsive_collision`, `text.truncation`,
  `a11y.focus_order` warning→error; update the four measure tests' severity
  expectations (deliberate fixture change: promotion is the mechanism working,
  ADR-005 decision 6); runner `skippedOutcome` derives from the constant
  instead of a hardcoded pair; C1 phase report gains the promotion record.
  Commit `feat(measure): promote four zero-overkill checks to error severity`.
- [ ] **G4 partial gate + docs sync** — smoke one matrix cell, phase report
  closes the program ledger (F4 open), architecture/README notes. Commit
  `docs: phase 4 framework sync + program ledger close`.
- [ ] **F4 ECP pilot** — OPEN. Operator-launched live session per the spec's
  entry conditions; fixture freeze completes Gate 4. Not executable here.

## Open for the user

1. F4 execution session (ECP cognition workspace, golden case #6).
2. Phase 3 stability-assignment confirmation (provisional grades on record).
3. Wizard 11px advisory disposition (accept or raise type sizes).

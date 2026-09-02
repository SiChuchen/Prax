# Phase 4 Replan — Empirical Loop Framework (2026-09-02)

Status: planned. Supersedes the program plan's Phase 4 skeleton
(`docs/superpowers/plans/2026-09-01-product-intelligence-chain.md` Phase 4);
binding scope F1–F5 unchanged, task-level detail added from Phase 1–3
evidence. ADR-005 decisions 6/8 and spec §8 of the chain design remain
authoritative.

## Evidence base (Phase 1–3)

- Measurement layer live: 7-check catalog, receipts verified end-to-end;
  calibration on landing/dashboard/wizard with zero remaining false positives
  (two over-kill fixes + one real defect fixed).
- Zero-overkill record: wizard (1 true advisory), dashboard (clean),
  landing (clean after WCAG 2.5.8 fix) → F5 promotion evidence per ADR-005
  decision 6.
- Knowledge restructure landed: trigger_conditions routing, myth quarantine,
  corpus merge — the benchmark's representation evidence can now cite
  corpus entries.

## F1 — Benchmark matrix + harness

- `benchmarks/product-intelligence-matrix/matrix.yaml`: 15 job×shape cells
  verbatim from research §43 (multiple object types folded into cell
  variants), each cell carrying `user_job`, `information_shape` (§6.1
  vocabulary), suggested `object_type`, and acceptance seed.
- `benchmarks/product-intelligence-matrix/run-cell.mjs <cell-id> --app <dir>`:
  spawns prax-measure against the cell's implementation, files the receipt
  under `benchmark-runs/product-intelligence-matrix/<cell-id>/`; the receipt
  IS the objective evidence layer (spec §8.2 — harness reuses prax-measure,
  no parallel measurement code).

## F2 — A/B protocol

- `benchmarks/product-intelligence-matrix/ab-protocol.md`: arms pinned
  (Arm A bare agent / Arm B same agent + Prax, same Product Brief); the 13
  evaluation metrics verbatim from §44; blind-review procedure reused from
  PRAX-AB-001 (`benchmark-runs/PRAX-AB-001/runbook.md` §Gate A–H), with the
  rubric-bias lesson recorded: process artifacts are excluded from blind
  bundles (under-credits the Prax arm — AB-001 lessons/prax-gaps.yaml).

## F3 — Inter-rater coding pilot + saturation ledger

- `benchmarks/product-intelligence-matrix/inter-rater-pilot.md`: the §45
  eight-field list (JTBD, Primary Object, Primary Representation, Density,
  Detail Surface, Context Retention, Progressive Disclosure, State
  Ownership), dual independent coding, disagreement comparison procedure.
- `data/saturation-ledger.yaml`: five counters per 30-sample band, seeded
  from §46's observed bands (1–30 heavy new, 31–60 new combinations,
  61–90 fewer new primitives, 91–120 mostly compositions/boundaries):
  total_coded, new_primitives, new_compositions, new_boundaries,
  new_pattern_rate.

## F4 — ECP cognition workspace pilot (open — requires a live session)

Golden case #6: representation architecture per research §40–41 (Canvas +
Change Timeline + Search + Inspector composition, no universal shell), full
chain ①→⑱, fixture frozen after completion. This is a live agent
implementation run (ECP workspace, external repo, human perceptual review)
— NOT executable inside the current orchestration session. Entry
conditions and freeze procedure are pinned in the plan; execution is an
operator-launched session.

## F5 — Check-promotion review (first accreting-gate instance)

Promote warning-born catalog checks with zero-overkill evidence on ALL
runnable golden apps (landing/dashboard/wizard) to error severity by
flipping the `ARTIFACT_CHECK_DEFAULT_SEVERITY` constants (spec §8.1
accreting-gate mechanism; promotion commit = first instance).

Promoted: `layout.overflow`, `layout.responsive_collision`,
`text.truncation`, `a11y.focus_order`.
NOT promoted: `type.min_projected_size` — spec §5.3 pins it advisory ("永不
默认 error"; density-linked thresholds deferred, §12 decision 11). The
wizard's 11px finding is a true advisory, not over-kill evidence against
the check, but the pinned per-check rule wins over the blanket F5 rule.

## Gate 4 (program exit)

1. Benchmark harness runs end to end on one matrix cell (smoke cell against
   a real build; full 150-cell execution is the next program, not this one).
2. A/B protocol reviewed (this document + ab-protocol.md).
3. Inter-rater pilot + saturation ledger framed.
4. F4 ECP fixture frozen — **open; blocks program exit** (operator session).
5. Phase report closes the keep/revise/remove/defer ledger for the whole
   program.

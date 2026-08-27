# PRAX-AB-001 Decision Gates (spec §43)

Date: 2026-08-27. Inputs: blinded-scores-1/2 (locked), comparison.yaml,
findings.yaml, six run packages. Evidence ceiling: L2_replicated_implementation
for process/cost observations; cross-arm outcome comparison INCONCLUSIVE at n=3.

## Gate A — Did Prax materially change agent behavior?

**Yes in process, not (yet) in outcome labels.** Observable behavior deltas in
3/3 Prax runs: a complete pre-implementation design record (confirmation →
understanding → routing → decisions → SDIR delta → locked validation plan →
compiled context) persisted and auditable; zero sessions abandoned the flow.
Outcome labels show no directional arm difference at this rubric granularity —
partly because the requirement snapshot was fully self-sufficient (finding-05),
which compresses the space where product-question discipline can matter.
No low-value artifact deletion indicated; all persisted artifacts were consumed
by the flow or the review.

## Gate B — Which primitive caused value?

- **Validation-before-code (H3)**: only primitive with an observed
  behavior-changing event (finding-04: 13px freeze test forced a mid-run fix,
  run-02 = strongest impl). Value signal: weak-positive, n=1.
- **Relationship layer (H1)**: exercised lightly (sdir delta regions); R7
  parity across arms. No signal either way at this task shape.
- **Context manifest + compilation (H2)**: artifacts produced, scoped, no
  leakage (P4); no counterfactual measurement possible in this design. Neutral.
- **Correction memory (H4)**: not exercised — no corrections existed to route
  (correctly empty; H4 belongs to PRAX-MEM-001 anyway).
- **Knowledge routing**: both arms got equivalent outcomes; cannot isolate.

## Gate C — What context was still missing?

- Empirical-evidence verification context: agents need to be told that
  empirical claims must cite artifacts, and browser evidence needs a runtime
  error check (finding-01) → classify: **tooling/evidence gap**.
- Everything else the agents self-served from the repo (0 questions).

## Gate D — Second independent case needed before stabilizing schema?

**Yes (default).** Also pick a task with real requirement ambiguity and a
different archetype (spec §36: Data/Log Explorer) so product-question discipline
and relationship-heavy surfaces actually differentiate the arms.

## Gate E — Did knowledge change at the correct scope?

No knowledge-base changes proposed. All findings are project-local or
tooling-local; `new_general_rules: []`. No recent-case bias risk materialized.

## Gate F — Did implementation drift reveal a supervision need?

**Partially.** The one drift-shaped miss (finding-01) was visible in the run's
own final evidence — final validation *content* was insufficient (agent
self-attestation), not merely timing. Minimal next step is NOT full Phase 8
supervision: extend validation-plan empirical checks with artifact references
and a browser runtime-error check. Re-evaluate supervision after the second case.

## Gate G — Did an implementation capability help or distort?

Not tested — no external skills routed (registry phases not built). Recorded
as not-applicable this round, per plan.

## Gate H — Repeated implementation worth an asset candidate?

The six implementations are candidates for **project-local recipes only**
(canvas readability recipe: camera floor + 2D region packing + docked
inspector + trace corridor). No user/org/domain asset promotion without a
second independent case.

## Provisional primitive decisions (final cross-case stop deferred to B6/B7)

| Primitive | Decision |
|---|---|
| Relationship three-layer | keep_provisional |
| Context Manifest v0.1 | keep_provisional |
| Persisted validation plan | keep_provisional **+ revise** (evidence attestation gap, finding-01) |
| Correction memory | keep_provisional (untested here; PRAX-MEM-001 pending) |
| Context compilation | keep_provisional |

## Honest claim set (max allowed)

- Directional, replicated (3/3) process signals: Prax flow completes reliably;
  cost medians +41% wall-clock / near-parity tokens; no workflow harm observed.
- Outcome quality: no directional difference observed; Prax arm held both the
  best and worst implementation.
- One concrete Prax-side defect found and one concrete Prax-side value event.
- No statistical significance claimed anywhere; n=3 per arm.

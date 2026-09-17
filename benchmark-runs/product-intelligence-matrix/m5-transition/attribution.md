# M5 transition — Arm-B process attribution (mechanical, from session artifacts)

Source: `b-session-audit.yaml` (all 20 B runs across R1+R2; script
`tools/b-session-audit.mjs`). This file CORRECTS one overstated claim in the
R1 follow-ups (see §1.1).

## 1. Gate-chain reality (corrected)

- **20/20 B sessions completed all eight gates confirm→framing→context→route→
  decide→sdir→reconcile→prepare** and entered validate.
- **Only 6/20 reached runtime `phase: COMPLETE`**; 14 ended at
  `phase: VALIDATION` — the agent delivered the product and stopped without
  closing the runtime's validate loop. Several of those had ALL self-reported
  items passing (R2 run-07 22/22, run-08 14/14, R1 run-15 16/16), i.e. the
  product was finished and the bookkeeping was not.
- **Correction:** R1 follow-ups said "10/10 sessions produced a validation
  report through the full chain" — the file's existence was mistaken for chain
  completion. The accurate statement is the one above. The pooled-n2-analysis
  wording "20/20 gate-chain completion" also overstates: read it as
  "20/20 completed all gates through prepare and entered validate; 6/20 closed
  the loop".
- **D6 resolved:** `measurement_target` was declared at prepare in **20/20**
  sessions — the unprepared-0.2 REVIEW concern from round 1 never materialized
  in practice.
- Self-measurement (session-run receipts): 13/20. Project corrections written
  (design_correct used): 6/20. Mean session duration ≈ 42 min.

## 2. Gate B evidence — what the router actually used

17 distinct knowledge entries were disclosed across 20 sessions (counts):
PAT-LIST-DETAIL 17 · PAT-LIST-DETAIL-INSPECTOR 13 · PAT-DATA-EXPLORER 8 ·
PAT-APPLICATION-SHELL 7 · H-13 7 · H-21 7 · PAT-WORKSPACE 6 · H-22 6 · P-19 6 ·
PAT-CANVAS-WORKSPACE 5 · WEB-DESKTOP 4 · H-19 4 · P-01 3 · P-22 3 · P-26 2 ·
P-28 1 · H-07 1.

Knowledge routing is genuinely load-bearing (not decorative): pattern
candidates appear in SDIR decisions, and Prax vocabulary demonstrably survives
into shipped code comments (the leakage packages). Which disclosure CAUSED
quality is still not separable without ablation (Gate B stays partially
supported).

## 3. Gate F finding — the validate closing gap

14 sessions stopped inside validate. Friction hypothesis (from artifacts, no
private-reasoning inference): the loop requires the agent to keep submitting
evidence items until the runtime flips COMPLETE; agents that finished coding
deprioritized the loop. Product follow-up candidate (NOT implemented here):
a lighter completion ack, or surfacing "n items outstanding" in the handoff.
Attribution for the one budget stop (R1 run-14): consistent with this friction.

## 4. Outcome reconciliation — why quality ties despite process differences

- Blind rubric pooled: 5/5/0, mean 0.00. Per cell: 4 sign-flips between rounds
  (j02 +0.34→−0.05, j06 +0.05→−0.39, j09 +0.39→−0.34, j10 +1.77→−0.83), 6
  stable (B-leaning j01 +0.25; A-leaning j04 −0.09, j07 −0.50→stable A;
  near-zero j05, j08, j13). The flips show within-cell round variance is the
  same order as the arm effect — single-sample cell differences are noise.
- Objective pooled: B 3.0/7 vs A 2.69/7; B's edge concentrates in
  layout.overflow (13/19 vs 8/16) and truncation (18/19 vs 14/16). A lead only
  on responsive_collision (15/16 vs 14/19).
- a11y-class checks fail nearly universally for BOTH arms (contrast 1/16 vs
  2/19, focus 1/16 vs 3/19, target size 4/16 vs 5/19, projected type 0/16 vs
  2/19) — the largest systemic signal in the whole pilot, independent of arm.

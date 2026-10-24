# M5 Loop Validation Report — 2026-10-24T19:46:12.967Z

Batch m5-loop-20261024. E1 = m5 frozen runtime fbf222e1… (ADR-006);
E0 = r3 frozen runtime 681653b4… (pre-ADR-006); sole runtime delta =
prax-mcp ADR-006 files (manifest-verified); prax-measure/prax-knowledge byte-identical.

## Arm results

- E0 (n=2): C=0/2, contrast=0, type=1, focus=1, target=0
- E1 (n=4): C=1/4, contrast=4, type=1, focus=4, target=4

## Per-slot (G1 phase · G2 checks · G3 engagement · cost)

- s1-e0(cell-j13-s10) phase=VALIDATION c=0 t=0 f=0 tg=0 loop=- fixEv=0 unavailEv=0 selfRx=0 $0 90min
- s3-e0(cell-j10-s09) phase=VALIDATION c=0 t=1 f=1 tg=0 loop=- fixEv=0 unavailEv=0 selfRx=0 $9.796 61min
- s2-e1(cell-j13-s10) phase=COMPLETE c=1 t=0 f=1 tg=1 loop=- fixEv=4 unavailEv=0 selfRx=5 $9.612 47min
- s4-e1(cell-j10-s09) phase=VALIDATION c=1 t=0 f=1 tg=1 loop=1 fixEv=2 unavailEv=0 selfRx=5 $9.01 55min
- s5-e1(cell-j13-s10) phase=VALIDATION c=1 t=0 f=1 tg=1 loop=- fixEv=2 unavailEv=0 selfRx=4 $9.849 62min
- s6-e1(cell-j10-s09) phase=VALIDATION c=1 t=1 f=1 tg=1 loop=- fixEv=2 unavailEv=0 selfRx=4 $7.41 31min

Batch cost: $45.68 / $120 ceiling.

## Readout (protocol §3 matrix; row 3)

**loop fails to close in-batch; agents ignored/never hit the loop → implementation/UX iteration; max action: iterate implementation. NOT removal (needs multi-cell evidence)**

Historical anchors (context only): R1+R2 pooled B-arm 6/20 COMPLETE; j13 {R1 V, R2 C, r3 V, m4×2 C}=3/5; j10 {R1 V, R2 V, r3 C}=1/3; r3 B-arm 3/10.

Action caps from protocol §5 apply (no H-23 retirement, no ADR-006 removal on rows 2/3/4 alone, no probe-mode adoption).

## Operator addendum — row-3 branch residual + mechanism (post-readout, no criteria change)

The §3 matrix's first-match rule lands on **row 3** (C(E1)=1/4 ≤ 1). Both
pre-registered row-3 branch descriptions misdescribe the observed mechanism:
unavailable_events = 0 in all four E1 runs (NOT infra-blocked), and
fix_required_events ≥ 2 in all four (agents did NOT ignore the loop — the
opposite: they engaged heavily). Recorded as a **branch-text residual**, same
honesty class as m4's row 7.

Mechanism (from frozen artifacts; validate status sequences above):

- **The loop converts non-measurement into measurement.** Every E1 session ran
  the loop ≥2 rounds and ended with 4–5 self-run receipts; validate calls per
  session: E1 = 15/11/8/9 vs E0 = 0/6. G2 confirms the conversion: contrast
  4/4 vs 0/2, target_size 4/4 vs 0/2, focus 4/4 vs 1/2 (no regression);
  type.min_projected_size is the loop's blind spot (1/4 vs 1/2 — feedback
  carries the smallest-px value but 3/4 E1 runs still shipped sub-12px text).
- **The closing bottleneck moved downstream, not away.** The three
  non-completing E1 runs all ended in `REVIEW:VALIDATION_CONVERGENCE_STALLED`
  after struggling through `MEASUREMENT_RECEIPT_MISSING` /
  `MEASUREMENT_BINDING_INVALID` blocks (s2, the one COMPLETE, hit the same
  wall at call 13, then recovered with two PASSes). The agent now measures
  and fixes — but repeated evaluate cycles trip the B3 convergence history
  and the receipt-binding rules, and the session ends in REVIEW before
  COMPLETE. s6 is the sharpest case: **all 7 operator checks green, still
  VALIDATION.**
- **s1-e0 is a pathological baseline session**: 977 ToolSearch calls, zero
  design_validate calls, wall-clock killed at 90 min (a legitimate stop; its
  $0 recorded cost is carried as a $15 allowance per operator-event D-1).
  s3-e0 replicated the classic R1/R2 j10 friction (6 validate calls, stops at
  VALIDATION with contrast/target failing).

Engineering implication (within row-3 action cap — iterate implementation,
no removal): Gate F now has a *specific, local* bottleneck — the interaction
of (a) measurement feedback rounds with (b) the B3 convergence-stall detector
and (c) receipt-binding validation. Candidate next slice: exclude
measurement-loop rounds from the convergence history entirely (ADR-006 §4
says feedback rounds must not enter B3 — the observed stalls suggest
receipt-citation re-submits and conventional EXPANDs after loop rounds still
do), and/or lighten the stall→REVIEW recovery path (m5-entry §3's
"lighter completion ack" candidate).

Batch accounting: $45.68 observed + $15 D-1 allowance (s1-e0) ≈ **$60.7 true
estimate** / $120 ceiling. Token budgets: all within (max 341k/1.2M).
Wall: 90/61/47/55/62/31 min. Model strings: glm-5.3-flash (s2 capture) /
glm-5.3-flash[1M] (CLI banner) — same flash routing as r1–m4.

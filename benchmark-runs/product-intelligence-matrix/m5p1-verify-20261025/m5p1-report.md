# M5.1 Live Verification Report — 2026-10-25T10:20:19.031Z

Batch m5p1-verify-20261025. E1' = m5p1 frozen runtime 183410df… (ADR-006 + m5.1);
E0' = m5 frozen runtime fbf222e1… (ADR-006, no m5.1); sole delta = m5.1 files
(manifest-verified 7 files); prax-measure/prax-knowledge/stdio entry identical.

## Arm results

- E0' (n=2): C=0/2, contrast=2, type=0, focus=2, target=2
- E1' (n=4): C=2/4, contrast=3, type=1, focus=4, target=4, Z1=0

## Per-slot (G1 phase · G1b stall · G2 checks · G3 engagement · cost)

- s1-e0(cell-j13-s10) phase=VALIDATION stall=zero_stall hist=[0,0,0,0] c=1 t=0 f=1 tg=1 loop=1 fixEv=4 unavailEv=0 selfRx=7 vCalls=11 $5.735 46min
- s3-e0(cell-j10-s09) phase=VALIDATION stall=zero_stall hist=[0,0,0,0] c=1 t=0 f=1 tg=1 loop=- fixEv=2 unavailEv=0 selfRx=4 vCalls=11 $8.661 55min
- s2-e1(cell-j13-s10) phase=VALIDATION stall=no_stall hist=[] c=1 t=0 f=1 tg=1 loop=- fixEv=3 unavailEv=0 selfRx=3 vCalls=7 $10.466 50min
- s4-e1(cell-j10-s09) phase=COMPLETE stall=closed hist=[] c=1 t=1 f=1 tg=1 loop=- fixEv=1 unavailEv=0 selfRx=6 vCalls=10 $7.5 46min
- s5-e1(cell-j13-s10) phase=COMPLETE stall=closed hist=[] c=1 t=0 f=1 tg=1 loop=- fixEv=1 unavailEv=0 selfRx=3 vCalls=10 $7.102 36min
- s6-e1(cell-j10-s09) phase=VALIDATION stall=no_stall hist=[] c=0 t=0 f=1 tg=1 loop=- fixEv=4 unavailEv=0 selfRx=3 vCalls=5 $7.08 57min

Batch cost: $46.54 / $120 ceiling (operator carries a $15 allowance per unobservable run, m5 D-1 class).

## Readout (protocol §3 matrix; row 2)

**PARTIAL: zero-phenotype eliminated (Z1=0) but residual non-completions persist — phenotypes: s2-e1=no_stall, s4-e1=closed, s5-e1=closed, s6-e1=no_stall; slice ② (discoverability) confirmed as the next bottleneck; no Gate F claim**

Historical anchors (context only): m5 E1 (fbf222e1) = 1/4 [s2 closed; s4 zero_stall; s5/s6 findings_stall]; m5 E0 (r3) = 0/2; R1+R2 6/20; per-cell m5: j13-E1 1/2, j10-E1 0/2.

Action caps from protocol §5 apply.

## Operator addendum — residual analysis (post-readout, no criteria change)

Row 2 is the mechanical verdict; the mechanism readout is stronger than
"partial" suggests:

- **m5.1 held live and did its job**: Z1=0 across all four E1' sessions; both
  in-batch controls replicated the m5 s4 phenotype exactly (history
  [0,0,0,0], zero_stall, VALIDATION); no E1' session stalled by ANY path.
  The two closing E1' runs are the m5.1 success shape in the wild: they
  pushed through 3–4 `MEASUREMENT_RECEIPT_MISSING` EXPAND rounds (zero-findings
  rounds that stalled m5's s4) and closed with PASS,PASS.
- **The residual is a NEW, narrower phenotype**: both non-closing E1' runs
  (s2, s6) ended on a validate call that returned **PASS** — PASS without
  COMPLETE means `missing_evidence` was still non-empty, and the output did
  not make "what is still outstanding" salient enough for the agent to
  continue. This is direct live evidence for the m5-entry §3 candidate #2
  ("surfacing n items outstanding in the handoff" / lighter completion ack),
  now the top Gate F residual ahead of any knowledge-side work.
- s6-e1's operator receipt shows contrast FAIL after a final-PASS stop
  (self-run receipts were older than the final edits — the m4
  applied-then-overwritten shape, descriptive note only).
- Slice ② (fix-hints, commit 39e5995) targets the m5 findings-stall
  phenotype; that phenotype did NOT recur in this batch's E1' (0/4).
  Its hints remain evidence-backed by m5 transcripts but are now
  **live-unverified** — same class of verification debt ADR-006 had before
  m5. Next candidate slice order: (a) PASS-with-outstanding-items handoff
  clarity (this batch's residual), (b) hints live verification piggybacked
  on the next batch.

Cost: $46.54 observed; no wall-clock kills (all runs agent_completed) → no
D-1 allowance needed this batch. All token budgets within (max 536k/1.2M).

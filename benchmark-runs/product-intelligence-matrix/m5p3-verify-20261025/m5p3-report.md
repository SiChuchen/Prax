# M5.3 Handoff-Clarity Live Verification Report — 2026-10-25T17:47:54.992Z

Batch m5p3-verify-20261025. E1'' = m5p3 frozen runtime 76bfda91… (ADR-006+m5.1+m5.2+m5.3);
E0'' = m5p1 frozen runtime 183410df… (ADR-006+m5.1); sole delta = m5.2+m5.3
files (manifest-verified); prax-measure/prax-knowledge/stdio entry identical.

## Arm results

- E0'' (n=2): C=0/2, contrast=1, type=0, focus=1, target=2
- E1'' (n=4): C=2/4, contrast=4, type=1, focus=2, target=3, submit_terminal=0/4

## Per-slot (G1 phase · stall · m5.3/m5.2 handoff · G2 · G3 · cost)

- s1-e0(cell-j13-s10) phase=VALIDATION stall=no_stall lastValidate=evaluate/EXPAND submitTerm=false notVerdict=0 hintFields=0 c=0 t=0 f=0 tg=1 fixEv=3 selfRx=3 vCalls=5 $0 90min
- s3-e0(cell-j10-s09) phase=VALIDATION stall=findings_stall lastValidate=submit_evidence/PASS submitTerm=true notVerdict=0 hintFields=0 c=1 t=0 f=1 tg=1 fixEv=2 selfRx=3 vCalls=9 $9.057 50min
- s2-e1(cell-j13-s10) phase=VALIDATION stall=no_stall lastValidate=evaluate/EXPAND submitTerm=false notVerdict=2 hintFields=0 c=1 t=0 f=0 tg=1 fixEv=3 selfRx=3 vCalls=5 $13.497 58min
- s4-e1(cell-j10-s09) phase=COMPLETE stall=closed lastValidate=evaluate/PASS submitTerm=false notVerdict=5 hintFields=0 c=1 t=0 f=1 tg=1 fixEv=1 selfRx=4 vCalls=10 $5.85 42min
- s5-e1(cell-j13-s10) phase=VALIDATION stall=no_stall lastValidate=evaluate/EXPAND submitTerm=false notVerdict=7 hintFields=0 c=1 t=0 f=0 tg=0 fixEv=8 selfRx=7 vCalls=17 $0 90min
- s6-e1(cell-j10-s09) phase=COMPLETE stall=closed lastValidate=evaluate/PASS submitTerm=false notVerdict=8 hintFields=0 c=1 t=1 f=1 tg=1 fixEv=1 selfRx=4 vCalls=19 $15.861 69min

Batch cost: $44.27 / $120 ceiling.

## Readout (protocol §3 matrix; row 2)

**PARTIAL: residuals s2-e1(phase=VALIDATION,last=evaluate/EXPAND,submitTerm=false) s4-e1(phase=COMPLETE,last=evaluate/PASS,submitTerm=false) s5-e1(phase=VALIDATION,last=evaluate/EXPAND,submitTerm=false) s6-e1(phase=COMPLETE,last=evaluate/PASS,submitTerm=false); if S1=0 the m5p1 residual is gone — classify the new terminal shape as the next-slice candidate**

Historical anchors (context only): m5p1 E1' = 2/4 [s2/s6 submit_terminal, s4/s5 closed]; m5p1 E0' = 0/2 (zero_stall); m5 E1 = 1/4; R1+R2 6/20.

Action caps from protocol §5 apply.

## Operator addendum — mechanism readout (post-readout, no criteria change)

Row 2 is the mechanical verdict; the mechanism layer shows the m5.3 target
ELIMINATED and the residual class transformed:

- **submit_terminal 2/4 → 0/4** (m5p1 E1' vs m5p3 E1''): the "read the
  acceptance PASS as the verdict and quit" terminal is gone. The not-a-verdict
  handoff was seen live in 4/4 E1'' sessions (2–8 occurrences each); both
  closers ended on the correct terminal (evaluate/PASS → COMPLETE).
- **Residual class is no longer signal misreading**:
  - s5-e1 is budget-limited: wall-killed at 90 min mid-maximal-effort
    (17 validate calls, 8 loop feedback events, 7 self-run receipts) — the
    clearest engagement the harness has ever recorded, stopped only by the
    clock.
  - s2-e1 is an agent-judgment stop: it SAW the open-validation signals
    (notVerdict messages + a final evaluate/EXPAND) and still concluded
    "交付完成", documenting residual validation status honestly in its own
    README. The signal was clear; the agent decided it was done.
- **m5.2 hints: 0 occurrences in treatment arms across two batches**
  (0/4 m5p1 E1', 0/4 m5p3 E1''). The findings-stall phenotype it targets
  recurred only on CONTROL arms (m5p3 s3-e0''). Live effect remains
  unverified — honest status: "target phenotype not yet reachable in the
  fixed runtime"; its verification now piggybacks on any future batch only
  if the phenotype recurs.
- **Control cumulative**: controls closed 0/4 across m5p1+m5p3 (incl. one
  wall-kill and one findings_stall+submit_terminal double) while treatment
  went 2/4 → 2/4 with shrinking, better-characterized residuals.
- **Descriptive dip**: focus 2/4 in E1'' (s2/s5 fail) vs 4/4 in m5p1 E1' —
  within batch-pair variance so far (E0''=1/2); monitor in any future batch.
- Closing trajectory (context only, cross-batch, NOT a pre-registered
  claim): R1+R2 baseline 30% → m5 E1 25% → m5p1 E1' 50% → m5p3 E1'' 50%
  with residuals now budget/judgment-limited instead of mechanism-limited.

Cost: $44.27 observed + $30 D-1 allowances (s1-e0, s5-e1 wall kills) ≈
$74.3 true estimate / $120. Token budgets: all within.

**Next-slice candidates (registered, no action without pre-registration)**:
(a) post-loop-cap handoff (s2 shape: after 3 measurement rounds, the
conventional EXPAND still does not say "run prax-measure yourself and cite
the receipt to close" prominently); (b) budget adequacy for maximal-effort
sessions (s5 shape) — wall budget vs the loop's measurement rounds; both
are Gate F economics, not signal clarity.

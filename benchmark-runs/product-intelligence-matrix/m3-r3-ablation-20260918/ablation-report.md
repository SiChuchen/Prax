# M3 Round-3 Ablation Report — H-23 "Accessibility AA Floor"

Batch: `m3-r3-ablation-20260918` · Report: 2026-10-24 · Status: R3-COMPLETE
Endpoints pre-registered 2026-09-18 in `protocol-addendum.md` (A1–A6) before any
r3 run and before the frozen snapshot was cut. This report compares the locked,
unblinded results against those frozen endpoints. An operator-side
`pre-analysis-note.md` (v2) documents the intermediate verification steps,
including a v1 misjudgment (based on incorrectly recalled baseline numbers)
that was retracted after checking the pre-registered text.

## 1. Execution summary

20/20 planned runs attempted and agent-completed. Measurement valid: A 10/10,
B 9/10 (run-18-b: `invalid_target: empty rendered document`; retained per D7
"failures are data", excluded from valid-receipt denominators per build-ledger
eligibility). Blind review: R1 20/20 + R2 20/20 parsed, locked before unblinding
(see `review-agreement.md`). Separation audit: 0 A-workspace prax
contamination, 20/20 unique roots.

## 2. Pre-registered endpoints vs measured

Archived baselines (A1, pooled R1+R2): B contrast 2/19, focus 3/19, type 2/19
(composite 7/57 ≈ 12.3%); A composite 7/64 ≈ 10.9%. Rubric baseline: B 4.35.

r3 measured (valid receipts): **B (n=9): contrast 2 (22.2%), focus 4 (44.4%),
type 0 (0%) — composite 6/27 = 22.2%. A (n=10): contrast 1 (10%), focus 4
(40%), type 0 (0%) — composite 5/30 = 16.7%.**

| Pre-registered clause (A4) | Threshold | Measured | Verdict |
|---|---|---|---|
| Success: B composite | ≥ 3× baseline (≥37%) | 22.2% (1.8×) | ✗ |
| Success: B − A composite | ≥ 20pp | +5.5pp | ✗ |
| Success: contrast or type ≥50% in B | ≥50% | 22.2% / 0% | ✗ |
| Partial: exactly one check improved ≥50% | exactly one | two improved >50% relative (contrast +111%, focus +181%); type regressed | ✗ |
| Control validity: A composite ≤ 2× baseline | ≤21.8% | 16.7% (1.53×) | ✓ control holds |
| Non-regression: B rubric vs 4.35 | ≥ −0.30 | 4.27 (−0.08) | ✓ |
| Route check: H-23 in B disclosures | must appear | 9/10 routing-logs (run-09-b absent) | ✓ disclosure occurred |

## 3. Conclusion (pre-registered framing)

**NEGATIVE — "disclosure without application" (Gate B negative evidence).**
H-23 was routed and disclosed in 9/10 B sessions, the control arm stayed valid,
the rubric non-regression held, but the causal composite endpoint moved to only
1.8× baseline (needed 3×) with a +5.5pp B−A gap (needed 20pp). The knowledge
mechanism delivered the entry into context; that delivery did not translate
into measured accessibility improvements at the pre-registered bar.

Honesty notes (required by protocol A5/inherited disciplines):

- **Power**: at n=9/10 per arm, no single-check contrast is statistically
  significant (B focus 4/9 vs 3/19, Fisher p≈0.22; contrast 2/9 vs 2/19,
  p≈0.63). "Negative" here means *below the pre-registered bar*, not proof of
  no effect. The bar itself (3× + 20pp) was set high deliberately.
- **Focus signal**: B focus_order 44.4% vs baseline 15.8% (2.8× relative, the
  only check with a sizeable relative gain) — flagged for follow-up, not
  counted as a partial (two checks exceeded 50% relative improvement, so the
  "exactly one" partial clause does not apply).
- **Convergent positive case**: impl-09 (run-17-b) is the only package scoring
  4 on the blind-review accessibility dimension and is also the best B-arm
  objective run (only `type.min_projected_size` failing). One convergent case
  out of 10 is anecdotal but consistent with a real-but-rare application
  pathway.
- **Model configuration**: all three batches report model `glm-5.3-flash[1M]`
  (operator confirms `--model sonnet` routes to glm-5.3-flash); no CLI-level
  drift across R1/R2/r3 was found. A v1 concern about baseline invalidation
  was checked against the pre-registered A-arm control clause and retracted.

## 4. Protocol gaps surfaced (for future rounds, not affecting this verdict)

1. `run-metadata.json` does not record the model/CLI version string — add it
   to `run-one.mjs` capture.
2. The measurement stack (Playwright/Chromium) is not pinned by the frozen
   runtime snapshot — pin or record browser version per batch.
3. Invalid measurement (run-18) has no retry/escalation path — decide
   explicitly (retry, or auto-fail with cause) in the next protocol revision.
4. A4's composite wording (run-level "receipts passing …") and its archived
   baseline arithmetic (instance-level 7/57) are ambiguous; this report judged
   under both readings (verdicts identical) — tighten wording next time.

## 5. Disposition

- Gate B now has its ablation signal: routing works (9/10), application at the
  pre-registered bar does not (this report). This closes the r3 ablation batch.
- `findings.yaml` / `comparison.md` / `review-agreement.md` carry the r3-alone
  blind-review record; pooled n=3 view across R1/R2/r3 follows in the M5
  transition ledger.
- Automation deleted by operator 2026-10-24; R3-COMPLETE marker written by
  `r3-loop.mjs` the same day.

## 6. Independent verification addendum (coordinator session, 2026-10-24)

A second coordinator pass re-derived the endpoints from the raw receipts
(`a11y-endpoints-r3.json`) and the session artifacts. Two corrections and one
refinement, none changing the NEGATIVE verdict:

1. **B focus_order pass count is 3/9 (33.3%), not 4/9 (44.4%)** — pass runs:
   run-02, run-10, run-17; run-11's focus is `skipped` (not pass). The
   instance-level composite therefore reads 5/27 ≈ 18.5% (not 6/27), and the
   focus relative gain is 2.1× (not 2.8×). Fisher p for 3/9 vs 3/19 ≈ 0.37 —
   the honesty note's substance stands, weaker.
2. **Route check needs two layers** (verified per session artifact):
   - routing-log.yaml (router SELECTION): H-23 in **9/10** B sessions
     (run-09-b the exception) — as reported;
   - session.yaml disclosures (actually SURFACED to the agent): H-23 in
     **2/10** (run-12, run-18). The gap is the L0–L3 progressive-disclosure
     authorization: the router selected the entry, the disclosure layer did
     not surface it in 8/10 sessions.
3. **Refined mechanism statement** (supersedes §3's "disclosure without
   application"): the failure has TWO stages — **selection-without-surfacing
   (8/10)** upstream of **surfacing-without-application (2/2 disclosed
   sessions showed no check improvement; run-18 invalid target, run-12
   all-fail)**. The routing-layer engineering candidate therefore splits:
   (a) why the disclosure layer does not surface an admitted, router-selected
   entry at the styling/validation phase, and (b) deterministic injection at
   validation-plan time regardless of brief keywords.

Run-level composite (a receipt passing all three) re-verified: 0/9 B, 0/10 A —
both pre-registered readings fail the success bar; verdict unchanged.

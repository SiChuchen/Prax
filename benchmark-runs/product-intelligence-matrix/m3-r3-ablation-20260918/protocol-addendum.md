# M3 Round-3 (ablation) Protocol — batch m3-r3-ablation-20260918

Status: PRE-REGISTERED 2026-09-18 BEFORE any r3 run and BEFORE the frozen r3
snapshot is cut. Operator-approved direction (a11y root-cause slice →
knowledge intervention, "选择最优的方案…照旧夜间执行").

## A1 — Purpose and hypothesis

Causal test of Prax's knowledge mechanism (the ablation signal Gate B never
had). Intervention: admitted knowledge entry **H-23 "Accessibility AA Floor"**
(draft; admission record `../m5-transition/H-23-admission.md`, committed
before this file). Baseline: pooled R1+R2 B-arm a11y pass rates on 35 valid
receipts — contrast 2/19, focus 3/19, target 5/19, type 2/19; A-arm —
contrast 1/16, focus 1/16, target 4/16, type 0/16.

## A2 — Design

10 cells × 2 arms × 1 planned run (20 runs), identical to R1/R2 design except:
the frozen runtime snapshot now CONTAINS H-23 (`pi-m3-frozen-runtime-r3-20260918`,
manifest hash recorded in runtime-lock.yaml after cutting; must differ from
23e770b3… precisely by the knowledge/test diff). Arm A remains the no-knowledge
control. Fresh sibling workspaces `pi-matrix-r3/<cell>-<arm>`; prompts
byte-identical to R1/R2 launch files; briefs hash-verified; budgets identical
(90 min / 1.2M in+out); client stack identical; `--strict-mcp-config`
isolation identical.

## A3 — Execution window

23:00–08:00 local; no new arm session after 06:30; no review session after
07:40; nightly 23:05 automation; idempotent driver `tools/r3-loop.mjs`.

## A4 — Pre-registered endpoints (frozen before any run)

Primary (causal): composite a11y endpoint = fraction of valid B receipts
passing contrast, type, and focus (target_size EXCLUDED from the primary
endpoint — its thin-element false-positive pressure is documented in
a11y-root-cause.md; it is reported as a secondary observational endpoint).

- **Success**: B-arm r3 composite ≥ 3× B baseline (baseline composite =
  7/57 ≈ 12.3% → success ≥ 37%), AND B-arm r3 composite exceeds A-arm r3
  composite by ≥ 20 percentage points, AND at least one of contrast/type
  individually reaches ≥ 50% pass in B.
- **Partial**: improvement on exactly one of the three checks ≥ 50%.
- **Negative**: otherwise — recorded as "routing ≠ application" Gate B
  negative evidence (checked: H-23 must appear in B session disclosures;
  if disclosed-but-no-effect, the finding is specifically "disclosure
  without application").
- Control validity: A-arm r3 composite within 2× of A baseline (7/64 ≈
  10.9%); a large A jump invalidates the control and the batch is reported
  as inconclusive.
- Non-regression: Prax arm rubric means (9 dims, pooled reviewers) must stay
  within −0.30 of the R1+R2 B baseline (4.35); a larger drop flags the entry
  as harmful regardless of a11y gains.
- Route check: H-23 disclosure presence extracted mechanically per B session
  (b-session-audit pattern).

## A5 — Analysis and records

r3-alone report (comparison/findings/review-agreement) + ablation report
(`ablation-report.md`) comparing endpoints against the archived baselines
above; then pooled n=3 view. Blind review identical (same rubric, two fresh
reviewers, lock before unblind). All events in operator-events.ndjson;
launch failures preserved per D7; no best-of selection; failures are data.

## A6 — Inherited

R1–R6 of `m3-r2-20260909/protocol-addendum.md` apply (fresh siblings, window,
pooled rules, honesty disciplines) with paths/batch id replaced by
m3-r3-ablation-20260918.

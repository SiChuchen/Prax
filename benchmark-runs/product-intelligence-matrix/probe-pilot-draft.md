# Contrastive Probe Pilot — DRAFT (2026-10-24, awaiting operator approval)

Locating where the H-23 knowledge chain breaks: disclosure → comprehension →
decision → implementation. Inspired by Harness²'s Propose–Probe–Compose
(same-task behavioral contrast, no ground truth needed). This draft becomes a
frozen protocol only after operator approval; no runs before that.

## Motivation

The r3 ablation verdict (ablation-report.md) is NEGATIVE — "disclosure without
application": H-23 was routed/disclosed in 9/10 B sessions but the composite
a11y endpoint stayed at 1.8× baseline (bar: 3×). A whole-batch A/B cannot tell
WHERE the chain broke. Four candidate breakpoints:

1. **Disclosure ≠ comprehension** — L0 one-line index disclosed; agent never
   called `design_inspect` to expand L2/L3.
2. **Comprehension ≠ decision** — expanded but too weak/generic to change
   design decisions.
3. **Decision ≠ implementation** — decided but lost on the way to CSS.
4. **Implementation ≠ survival** — applied early, overwritten later by other
   constraints.

## Design (single cell, 4 probe arms, 6 runs)

Cell: **cell-j13-s10** (run-02-b in r3: H-23 disclosed AND contrast still
failed — the canonical broken-chain instance; same brief, byte-identical).

| Arm | n | Configuration | What it isolates |
|---|---|---|---|
| P0 | 1 | No Prax (= arm-A config) | raw model baseline |
| P1 | 2 | Standard arm B (H-23 via normal routing) | status quo (r3 replication, in-batch) |
| P2 | 2 | B + H-23 full text (L1–L3) appended to the launch prompt | disclosure depth (breakpoint 1) |
| P3 | 1 | B + one measurement-feedback round: agent runs, prax-measure contrast/focus/type result returned, agent fixes once | feedback loop closure (breakpoints 3–4) |

Budget: 6 runs ≈ $50–60 total, single night. Same frozen runtime snapshot as
r3 (manifest 681653b4…); same 90-min/1.2M budgets; same flash model routing.

## Pre-registered readout matrix (freeze before any run)

Primary endpoint: contrast pass rate + **mechanical behavioral-trace checks on
the final artifact** (process-level evidence, the new ingredient):

- T1: low-contrast token replacement (slate-400/500-on-white → slate-600+) in CSS
- T2: visible focus indication CSS present (outline/focus-visible rules)
- T3: minimum font-size floor (≥12px) declared anywhere

Interpretation:

- P2 > P1 with traces present → breakpoint 1 (disclosure depth) → fix
  disclosure mechanism (auto-expand L2 at decide-time for admitted entries)
- P2 ≈ P1 but P3 > P2 → breakpoint 3/4 (no feedback signal) → close the
  measure→fix loop in `design_validate` UX
- P2 ≈ P1 ≈ P0, no traces anywhere → the entry itself is inert → rewrite H-23
  (more specific, palette-level dos/don'ts) or retire it
- P1 > P0 in-batch while r3 batch showed nothing → r3 was underpowered →
  adopt probe mode as the standard per-entry verification path

## Batch-comparability checklist (binds all future protocols; from r3 §4)

1. `run-one.mjs` extracts and records the model version string into
   run-metadata (from the stream-json transcript `model` field).
2. Measurement-stack fingerprint (Playwright + Chromium versions) written into
   run-metadata per run.
3. Invalid measurement (`invalid_target`) auto-retries exactly once; a second
   failure is archived with cause (no silent skips).
4. Composite-endpoint wording must state run-level vs instance-level
   explicitly; thresholds must arithmetically match the stated baseline.

## Relation to Harness²

This pilot is a single-step, hand-rolled Propose–Probe–Compose: P1/P2/P3 are
candidate harness variants probed on the same task; the readout matrix is the
behavioral contrast. If the pilot works, the loop generalizes into the
standard knowledge-admission path (18-question intake → 6-run probe → adopt /
rewrite / retire), replacing whole-batch ablations for per-entry verification.

## Status

DRAFT. On operator approval: freeze the readout matrix, cut the probe batch
directory (`m4-probe-20261024/`), register slots, execute within the night
window or daytime with operator consent (r3 precedent: daytime completion
2026-10-24).

# a11y failure root-cause investigation — M5 engineering slice ①

Investigated 2026-09-18 over ALL receipts from R1+R2 (40 receipt files, 35
valid measurement runs; some runs carry two receipts from re-measurement).
Rules verified against the frozen runtime source: contrast = WCAG 2.2 AA
(4.5:1 / 3.0:1 large), focus order = zero missing indicators AND zero
inversions, target size = interactive elements ≥24×24 CSS px (either
dimension), primary text ≥12px.

## Findings per check (fail counts across receipts)

### a11y.contrast — fail 32/40 — REAL, gross, systemic palette habit
9,183 failing element pairs. Gap below threshold: median **48%**, p75 72%;
only 9% are near-misses (≤20%), 47% are >50% below (ratio <2.25).
8,067/9,183 failing pairs are `<span>` text (body/secondary copy), not
controls. Signature failure (verified by recomputing WCAG by hand):
`rgb(148,163,184)` = Tailwind **slate-400** on white = 2.56:1 (buttons,
captions); slate-500 on slate-50 = 4.4:1 (one-shade near-miss vs 4.5).
**Root cause: agents default to Tailwind-slate muted palettes for secondary
text without checking ratios. Measurement verified correct — NOT a check bug.**
Fix type: knowledge entry (exact numbers + the specific anti-pattern "never
use gray-300/400-class tokens for text on light backgrounds; verify 4.5:1/3:1").

### a11y.target_size — fail 26/40 — MIXED; check refinement candidate
2,425 flagged elements, but median max-dimension is **441px** — ~95% are
thin/long interactive elements (one dimension <24: dividers, separators,
line-height-bound rows), only ~112 are genuinely small (both dims <24, mostly
18×18 or 20×20 buttons; just 2 below 12px). The frozen check flags on EITHER
dimension <24px, so full-width-but-thin interactive rows dominate the failures.
**Root cause split: ~5% real small targets (habit) + ~95% thin-element
false-positive pressure.** Fix type: knowledge entry (24px floor) + a
**check-refinement proposal** (align the element filter with WCAG 2.2
target-size exceptions / require a minimum-area or both-dimensions rule) —
to be implemented only through the zero-overkill calibration process, not in
this batch.

### type.min_projected_size — fail 33/40 — NEAR-MISS habit, trivially fixable
Every failing receipt's min font sits at **8.5–11.5px** (never ≥12, never <8):
badges, table cells, secondary spans. Fix type: knowledge entry ("12px floor
for any text; prefer 14px for body").

### a11y.focus_order — fail 27/40 — BIMODAL
Small inversion counts (1–3) in most failures; a few pages with 24–62 missing
focus indicators (CSS resets stripping default outlines). Fix type: knowledge
entry ("never remove focus outlines; add :focus-visible styles; keep DOM order
= visual order").

## Verdict

1. Three of four failing checks are **knowledge-fixable design habits**
   (contrast palettes, sub-12px text, stripped focus styles) — draft knowledge
   entry proposed below, to go through the 18-question admission process with
   the next run batch.
2. One check (target_size) has a **false-positive pressure** from thin
   elements — check-refinement proposal only, zero-overkill calibration
   required before any change.
3. No measurement-layer bug was found in contrast (hand-verified), type, or
   focus aggregates.

## Draft knowledge entry (PROPOSAL — not promoted; admission via 18-question process)

- id candidate: `A11Y-AA-FLOOR`
- trigger: any web UI implementation, before final styling pass
- content: text contrast ≥4.5:1 normal / ≥3:1 large (≥24px or ≥18.66px bold);
  never use 300/400-gray tokens for text on light backgrounds; interactive
  targets ≥24×24 in BOTH dimensions; keep visible focus indicators
  (`:focus-visible`), never `outline: none` without replacement; minimum text
  size 12px (body 14px+); DOM order must match visual reading order.
- authority_initial: recommended; review_by: after next benchmark batch with
  this entry active (its effect on the four checks becomes the ablation
  signal Gate B never had).

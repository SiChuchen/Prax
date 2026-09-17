# M3 pooled n=2 analysis (R1 + R2) — 2026-09-17T15:34:48.264Z

Rule (pre-registered in R5 before any r2 outcome): per cell/arm the score is the
mean over VALID runs of both rounds; no best-of selection; cells where an arm
has no valid run are excluded from rubric pairing and listed separately.

## Headline

- R1 alone: B − A = **+0.32** (B better 7 / A better 1 / tie 2).
- R2 alone: B − A = **−0.20** (B better 3 / A better 6 / tie 1).
- **Pooled n=2: B − A overall tally 5/5/0 (n=10), mean 0.**
- The round-1 lean toward Arm B did NOT replicate; pooled, the blind-rubric
  difference is small and its sign depends on the sensitivity cut. This is a
  legitimate pilot outcome: no reliable product-quality advantage is
  demonstrated in either direction.

## Arm aggregates over all 40 runs

| | Arm A (bare) | Arm B (Prax) |
|---|---|---|
| runs / agent declared done | 20 / 20 | 20 / 19 |
| operator measurement valid | 16 | 19 |
| mean wall clock (s) | 2037.2 | 3091.5 |
| mean tokens in+out | 397230.45 | 485947.16 |
| mean cost USD | 5.8 | 9.08 |
| mean rubric (valid runs) | 4.36 | 4.35 |

## Pooled objective layer (seven browser checks, valid runs)

| | A | B |
|---|---|---|
| valid runs | 16 | 19 |
| mean pass of 7 | 2.69 | 3 |
| per check | layout.overflow 8/16, layout.responsive_collision 15/16, text.truncation 14/16, a11y.contrast 1/16, a11y.focus_order 1/16, a11y.target_size 4/16, type.min_projected_size 0/16 |
| (B) | layout.overflow 13/19, layout.responsive_collision 14/19, text.truncation 18/19, a11y.contrast 2/19, a11y.focus_order 3/19, a11y.target_size 5/19, type.min_projected_size 2/19 |

## Reliability signals that DO replicate across both rounds

1. Arm B's full gate-chain completion: 20/20 B sessions produced a complete
   Prax artifact chain through validation (A: 19/20 declared completion — the
   one non-completion was B run-14 in R1, wall-clock stop).
2. Arm B spends more: wall ≈1.4–1.7× and cost ≈2.0–2.2× of A in both rounds.
3. Both arms fail the a11y-class checks (contrast, focus order, target size,
   projected type size) across rounds — systemic, not an arm effect.

## Paired cells (pooled)

| cell | A valid | B valid | A | B | B−A | leak |
|---|---|---|---|---|---|---|
| cell-j01-s01 | 2/2 | 2/2 | 4.28 | 4.53 | 0.25 | undefined |
| cell-j02-s02 | 2/2 | 1/2 | 4.44 | 4.39 | -0.05 | undefined |
| cell-j04-s04 | 2/2 | 2/2 | 4.42 | 4.33 | -0.09 | undefined |
| cell-j05-s05 | 1/2 | 2/2 | 4.22 | 4.47 | 0.25 | undefined |
| cell-j06-s06 | 1/2 | 2/2 | 4.39 | 4.33 | -0.06 | undefined |
| cell-j07-s07 | 2/2 | 2/2 | 4.53 | 4.25 | -0.28 | undefined |
| cell-j08-s08 | 2/2 | 2/2 | 4.33 | 4.38 | 0.05 | undefined |
| cell-j09-s03 | 1/2 | 2/2 | 4.39 | 4.55 | 0.16 | undefined |
| cell-j10-s09 | 1/2 | 2/2 | 4.44 | 4.03 | -0.41 | undefined |
| cell-j13-s10 | 2/2 | 2/2 | 4.14 | 4.28 | 0.14 | undefined |

Overall (n=10 pairable): B better 5, A better 5, tie 0, mean 0.
By-dimension and sensitivity (excluding unblinding-leakage cells) in
pooled-n2-findings.yaml. Reviewer agreement per round: blind ±1 agreement
95–100% (R1) and 100% (R2) — model reviewers share model priors; not human
agreement.

## Honest bottom line

Two independent runs per cell/arm on an identical frozen runtime show **no
directionally stable blind-rubric advantage for either arm**. Arm B's
replicable differences are process-shaped (complete gate chain, higher
measurement validity of its own sessions) at ~1.5× wall and ~2× cost.
Objective seven-check means slightly favor B in R1 and the pooled set, driven
by overflow/truncation; a11y checks fail for both arms. All findings remain
exploratory (n=2, model reviewers); no significance claims, no promotion.

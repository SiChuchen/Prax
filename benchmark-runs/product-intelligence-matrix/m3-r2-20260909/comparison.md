# M3 pilot comparison — 2026-09-17T15:31:20.393Z

Scope: 10 cells × 2 arms × 1 planned run (20 runs). Exploratory pilot; one
heterogeneous run per cell/arm supports observations, NOT replicated per-cell
or statistically significant superiority claims. Conclusion may legitimately be
"no advantage" or "insufficient data".

## Denominators

- Planned 20 / attempted 20 / agent-declared completion 19 / wall-clock stopped 1 (run-14, B).
- Receipts 20/20; measurement valid (target not invalidated) 18/20 — invalid: run-13 (B, cell-j02-s02: app navigated to `#_` during measurement), run-17 (A, cell-j10-s09: page runtime error `reading 'steps'`).
- Blind-review eligible 20/20; reviewer JSON parsed R1 20/20, R2 20/20.
- Token telemetry observable 19/20 (run-14 not_observable: killed before result event).
- M3 gate: NOT CLOSED — 8/10 cells have both arms with valid measurement evidence.

## Arm aggregates (means over runs; costs from modelUsage input+output, D5 v2)

| | Arm A (bare) | Arm B (Prax) |
|---|---|---|
| runs / agent completed | 10 / 10 | 10 / 10 |
| measurement valid | 7 | 10 |
| mean wall clock (s) | 2166.9 | 2980.7 |
| mean tokens in+out (observable n) | 447506 (10) | 489005.4 (10) |
| mean cost USD | 7.38 | 9.01 |
| mean blind rubric (mean of 9 dims, 2 reviewers) | 4.44 | 4.24 |

## Paired cell-level outcome (B − A, mean of 9 dims averaged over both reviewers)

| cell | A id | B id | A | B | B−A | A wall | B wall | A tok | B tok | valid A/B | leak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cell-j01-s01 | impl-06 | impl-13 | 4.22 | 4.33 | 0.11 | 3267 | 3414 | 1179293 | 448571 | true/true | 1 |
| cell-j02-s02 | impl-17 | impl-11 | 4.44 | 4.39 | -0.05 | 1519 | 2517 | 234562 | 329202 | true/true | 0 |
| cell-j04-s04 | impl-02 | impl-04 | 4.44 | 4.28 | -0.16 | 1902 | 3148 | 378937 | 358941 | true/true | 1 |
| cell-j05-s05 | impl-01 | impl-09 | 4.61 | 4.61 | 0 | 2953 | 3267 | 782835 | 716222 | false/true | 0 |
| cell-j06-s06 | impl-03 | impl-05 | 4.61 | 4.22 | -0.39 | 1249 | 2296 | 284903 | 504278 | false/true | 2 |
| cell-j07-s07 | impl-14 | impl-16 | 4.5 | 4 | -0.5 | 1319 | 2143 | 191826 | 302550 | true/true | 0 |
| cell-j08-s08 | impl-07 | impl-15 | 4.33 | 4.44 | 0.11 | 2309 | 2529 | 541730 | 446682 | true/true | 0 |
| cell-j09-s03 | impl-08 | impl-19 | 4.67 | 4.33 | -0.34 | 1772 | 2500 | 455534 | 397367 | false/true | 0 |
| cell-j10-s09 | impl-12 | impl-18 | 4.44 | 3.61 | -0.83 | 2784 | 2903 | 220908 | 307015 | true/true | 0 |
| cell-j13-s10 | impl-10 | impl-20 | 4.17 | 4.22 | 0.05 | 2595 | 5090 | 204532 | 1079226 | true/true | 1 |

Overall tally (cells): B better 3, A better 6, tie 1, mean B−A -0.2 (n=10).

### By dimension (B − A tally over cells)

| dimension | n | B better | A better | tie | mean diff |
|---|---|---|---|---|---|
| representation_fit | 10 | 0 | 0 | 10 | 0 |
| primary_task_salience | 10 | 0 | 3 | 7 | -0.35 |
| time_to_understand | 10 | 1 | 4 | 5 | -0.4 |
| navigation_cost | 10 | 0 | 0 | 10 | 0 |
| context_loss | 10 | 0 | 0 | 10 | 0 |
| ui_surface_complexity | 10 | 6 | 2 | 2 | 0.2 |
| accessibility | 10 | 0 | 4 | 6 | -0.35 |
| frontend_rework | 10 | 1 | 7 | 2 | -0.9 |
| acceptance_seed_coverage | 10 | 0 | 0 | 10 | 0 |

### Sensitivity

- Excluding packages with unavoidable unblinding (Prax vocabulary in comments): B better 1, A better 4, tie 1, mean -0.27 (n=6).
- Only cells where BOTH arms have valid measurement: B better 3, A better 4, tie 0, mean -0.18 (n=7).

## Objective layer (seven browser checks; not task time / retrieval / preference)

See run-ledger.yaml `checks` per run. These checks do not measure task
completion time, information retrieval accuracy, user error rate, or human
preference — all marked not_observable in this pilot. Model preference is not
human preference.

## What this pilot does and does not support

- Supports: exploratory paired observations across 10 heterogeneous cells,
  process-reliability observations (completion, wall clock, token cost, gate
  friction), and measurement-validity accounting.
- Does not support: replicated per-cell claims, significance, human-preference
  claims, or any promotion of checks/knowledge (deferred).

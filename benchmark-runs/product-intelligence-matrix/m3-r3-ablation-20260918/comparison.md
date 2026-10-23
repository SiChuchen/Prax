# M3 pilot comparison — 2026-10-23T18:14:27.970Z

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
| measurement valid | 10 | 9 |
| mean wall clock (s) | 2178.4 | 2732.4 |
| mean tokens in+out (observable n) | 388734.6 (10) | 465104.7 (10) |
| mean cost USD | 4.67 | 8.97 |
| mean blind rubric (mean of 9 dims, 2 reviewers) | 4.43 | 4.27 |

## Paired cell-level outcome (B − A, mean of 9 dims averaged over both reviewers)

| cell | A id | B id | A | B | B−A | A wall | B wall | A tok | B tok | valid A/B | leak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cell-j01-s01 | impl-17 | impl-10 | 4.39 | 4.39 | 0 | 1254 | 2905 | 317744 | 276400 | true/true | 0 |
| cell-j02-s02 | impl-04 | impl-20 | 4.61 | 4.56 | -0.05 | 1097 | 1761 | 123985 | 292224 | true/true | 0 |
| cell-j04-s04 | impl-12 | impl-06 | 4.44 | 4.44 | 0 | 5184 | 3075 | 1091505 | 449790 | true/true | 9 |
| cell-j05-s05 | impl-16 | impl-18 | 4.33 | 4.33 | 0 | 2455 | 2660 | 371511 | 599923 | true/true | 1 |
| cell-j06-s06 | impl-08 | impl-09 | 4.44 | 4.78 | 0.34 | 2359 | 3828 | 566202 | 641433 | true/true | 1 |
| cell-j07-s07 | impl-13 | impl-05 | 4.39 | 4.5 | 0.11 | 2995 | 2790 | 417078 | 341061 | true/true | 0 |
| cell-j08-s08 | impl-11 | impl-14 | 4.39 | 2.5 | -1.89 | 1052 | 2090 | 113459 | 340779 | true/false | 6 |
| cell-j09-s03 | impl-07 | impl-15 | 4.5 | 4.5 | 0 | 2046 | 2313 | 314918 | 386512 | true/true | 0 |
| cell-j10-s09 | impl-03 | impl-01 | 4.39 | 4.5 | 0.11 | 2104 | 3021 | 285576 | 610871 | true/true | 0 |
| cell-j13-s10 | impl-19 | impl-02 | 4.39 | 4.22 | -0.17 | 1238 | 2881 | 285368 | 712054 | true/true | 0 |

Overall tally (cells): B better 3, A better 3, tie 4, mean B−A -0.15 (n=10).

### By dimension (B − A tally over cells)

| dimension | n | B better | A better | tie | mean diff |
|---|---|---|---|---|---|
| representation_fit | 10 | 0 | 1 | 9 | -0.2 |
| primary_task_salience | 10 | 0 | 1 | 9 | -0.4 |
| time_to_understand | 10 | 2 | 3 | 5 | -0.4 |
| navigation_cost | 10 | 0 | 1 | 9 | -0.2 |
| context_loss | 10 | 0 | 1 | 9 | -0.05 |
| ui_surface_complexity | 10 | 3 | 4 | 3 | 0 |
| accessibility | 10 | 1 | 0 | 9 | 0.2 |
| frontend_rework | 10 | 3 | 2 | 5 | -0.2 |
| acceptance_seed_coverage | 10 | 0 | 1 | 9 | -0.15 |

### Sensitivity

- Excluding packages with unavoidable unblinding (Prax vocabulary in comments): B better 2, A better 2, tie 2, mean 0 (n=6).
- Only cells where BOTH arms have valid measurement: B better 3, A better 2, tie 4, mean 0.04 (n=9).

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

# M3 pilot comparison — 2026-09-08T22:11:32.574Z

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
| runs / agent completed | 10 / 10 | 10 / 9 |
| measurement valid | 9 | 9 |
| mean wall clock (s) | 1907.5 | 3202.3 |
| mean tokens in+out (observable n) | 346954.9 (10) | 482549.11 (9) |
| mean cost USD | 4.22 | 9.15 |
| mean blind rubric (mean of 9 dims, 2 reviewers) | 4.18 | 4.5 |

## Paired cell-level outcome (B − A, mean of 9 dims averaged over both reviewers)

| cell | A id | B id | A | B | B−A | A wall | B wall | A tok | B tok | valid A/B | leak |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cell-j01-s01 | impl-09 | impl-13 | 4.33 | 4.72 | 0.39 | 2632 | 5401 | 581899 | — | true/true | 1 |
| cell-j02-s02 | impl-15 | impl-17 | 4.44 | 4.78 | 0.34 | 2145 | 3756 | 497943 | 553621 | true/false | 0 |
| cell-j04-s04 | impl-01 | impl-18 | 4.39 | 4.39 | 0 | 1560 | 3398 | 267604 | 587483 | true/true | 0 |
| cell-j05-s05 | impl-02 | impl-12 | 4.22 | 4.33 | 0.11 | 2516 | 3060 | 536203 | 432233 | true/true | 0 |
| cell-j06-s06 | impl-14 | impl-20 | 4.39 | 4.44 | 0.05 | 1204 | 1631 | 194618 | 331510 | true/true | 0 |
| cell-j07-s07 | impl-05 | impl-08 | 4.56 | 4.5 | -0.06 | 1926 | 3886 | 225526 | 552952 | true/true | 2 |
| cell-j08-s08 | impl-19 | impl-10 | 4.33 | 4.33 | 0 | 1628 | 2336 | 436604 | 382667 | true/true | 1 |
| cell-j09-s03 | impl-03 | impl-06 | 4.39 | 4.78 | 0.39 | 1350 | 2645 | 124361 | 462889 | true/true | 0 |
| cell-j10-s09 | impl-04 | impl-07 | 2.67 | 4.44 | 1.77 | 2187 | 2312 | 390986 | 391365 | false/true | 0 |
| cell-j13-s10 | impl-11 | impl-16 | 4.11 | 4.33 | 0.22 | 1927 | 3598 | 213805 | 648222 | true/true | 0 |

Overall tally (cells): B better 7, A better 1, tie 2, mean B−A 0.32 (n=10).

### By dimension (B − A tally over cells)

| dimension | n | B better | A better | tie | mean diff |
|---|---|---|---|---|---|
| representation_fit | 10 | 1 | 1 | 8 | 0.1 |
| primary_task_salience | 10 | 2 | 1 | 7 | 0.3 |
| time_to_understand | 10 | 4 | 1 | 5 | 0.45 |
| navigation_cost | 10 | 1 | 0 | 9 | 0.3 |
| context_loss | 10 | 2 | 0 | 8 | 0.15 |
| ui_surface_complexity | 10 | 4 | 2 | 4 | 0.25 |
| accessibility | 10 | 4 | 0 | 6 | 0.75 |
| frontend_rework | 10 | 8 | 2 | 0 | 0.5 |
| acceptance_seed_coverage | 10 | 1 | 0 | 9 | 0.1 |

### Sensitivity

- Excluding packages with unavoidable unblinding (Prax vocabulary in comments): B better 6, A better 0, tie 1, mean 0.41 (n=7).
- Only cells where BOTH arms have valid measurement: B better 5, A better 1, tie 2, mean 0.14 (n=8).

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

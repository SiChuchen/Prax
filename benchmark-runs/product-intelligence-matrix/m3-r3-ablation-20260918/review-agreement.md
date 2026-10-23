# Review agreement (computed BLIND, before unblinding) — 2026-10-23T18:14:27.970Z

Two independent fresh reviewers (R1, R2; identical rubric, model glm-5.3-flash[1M]
via claude 2.1.251, zero MCP, cwd locked to the anonymous package) scored all
packages. Scores were hashed and locked (review/scores-lock.sha256) before this
comparison. Parsed JSON: R1 20/20, R2 20/20.

| dimension | n | exact % | within ±1 % | mean |diff| |
|---|---|---|---|---|
| representation_fit | 20 | 95 | 95 | 0.1 |
| primary_task_salience | 20 | 100 | 100 | 0 |
| time_to_understand | 20 | 70 | 100 | 0.3 |
| navigation_cost | 20 | 95 | 95 | 0.1 |
| context_loss | 20 | 95 | 100 | 0.05 |
| ui_surface_complexity | 20 | 70 | 100 | 0.3 |
| accessibility | 19 | 100 | 100 | 0 |
| frontend_rework | 20 | 35 | 85 | 0.8 |
| acceptance_seed_coverage | 20 | 95 | 100 | 0.05 |

This is outcome-review agreement between two model reviewers on a 1–5 rubric,
not the separate M4 taxonomy coding study and not human agreement. Unavoidable
unblinding: impl-06 (9 hits), impl-09 (1 hit), impl-14 (6 hits), impl-18 (1 hit) —
Prax vocabulary in code comments; recorded, product not edited; reviewers were
instructed not to speculate about provenance; sensitivity analysis excludes them.
